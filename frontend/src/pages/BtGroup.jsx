import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

/** BT API returns trolls under data.trolls (object keyed by id) or legacy top-level trolls. */
function normalizeBtTrolls(apiPayload) {
  const t = apiPayload?.data?.trolls ?? apiPayload?.trolls;
  if (!t || typeof t !== 'object') return [];
  if (Array.isArray(t)) {
    return t.map((row, i) => (row && typeof row === 'object' ? { ...row, id: row.id != null ? row.id : i } : { id: i }));
  }
  return Object.entries(t).map(([key, row]) => {
    const r = row && typeof row === 'object' ? row : {};
    return { ...r, id: r.id != null ? r.id : key };
  });
}

function starredStorageKey(userId) {
  return `mountyhapp_bt_starred_ids_${userId}`;
}

function filterStorageKey(userId) {
  return `mountyhapp_bt_starred_filter_${userId}`;
}

const BT_EYE_SVG_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function BtPaEyeStriked() {
  return (
    <svg {...BT_EYE_SVG_PROPS} aria-hidden="true">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
      <line x1="2" y1="22" x2="22" y2="2" />
    </svg>
  );
}

/** Striked eye next to PA only when camouflé (yellow) or invisible (red). If both flags, invisible wins. */
function BtPaVisibilityEye({ troll }) {
  const invisible = Boolean(troll.invisible);
  const camoufle = Boolean(troll.camoufle);

  if (invisible) {
    return (
      <span className="name-box-red bt-pa-eye-icon-wrap" aria-label="Invisible">
        <BtPaEyeStriked />
      </span>
    );
  }
  if (camoufle) {
    return (
      <span className="name-box-yellow bt-pa-eye-icon-wrap" aria-label="Camouflé">
        <BtPaEyeStriked />
      </span>
    );
  }
  return null;
}

const BtGroup = () => {
  const { user } = useAuth();
  const [trolls, setTrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [tooltip, setTooltip] = useState({ show: false, content: '', title: '', x: 0, y: 0 });
  const [expandedCardIds, setExpandedCardIds] = useState(() => new Set());
  const [expandedBonusMalusCardIds, setExpandedBonusMalusCardIds] = useState(() => new Set());
  const [bonusMalusById, setBonusMalusById] = useState({});
  const [starredIds, setStarredIds] = useState(() => new Set());
  const [showStarredOnly, setShowStarredOnly] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    try {
      const raw = localStorage.getItem(starredStorageKey(user.id));
      const parsed = JSON.parse(raw || '[]');
      setStarredIds(new Set(Array.isArray(parsed) ? parsed : []));
    } catch {
      setStarredIds(new Set());
    }
    try {
      setShowStarredOnly(localStorage.getItem(filterStorageKey(user.id)) === '1');
    } catch {
      setShowStarredOnly(false);
    }
  }, [user?.id]);

  const toggleStar = useCallback(
    (id) => {
      if (user?.id == null) return;
      const sid = String(id);
      setStarredIds((prev) => {
        const next = new Set(prev);
        if (next.has(sid)) next.delete(sid);
        else next.add(sid);
        localStorage.setItem(starredStorageKey(user.id), JSON.stringify([...next]));
        return next;
      });
    },
    [user?.id]
  );

  const toggleStarredFilter = useCallback(() => {
    setShowStarredOnly((v) => {
      const next = !v;
      if (user?.id != null) {
        localStorage.setItem(filterStorageKey(user.id), next ? '1' : '0');
      }
      return next;
    });
  }, [user?.id]);

  const showAllTrolls = useCallback(() => {
    setShowStarredOnly(false);
    if (user?.id != null) {
      localStorage.setItem(filterStorageKey(user.id), '0');
    }
  }, [user?.id]);

  const displayTrolls = useMemo(() => {
    if (!showStarredOnly) return trolls;
    return trolls.filter((t) => starredIds.has(String(t.id)));
  }, [trolls, showStarredOnly, starredIds]);

  useEffect(() => {
    fetchGroupTrolls();
  }, []);

  useEffect(() => {
    if (loading || trolls.length === 0) {
      if (trolls.length === 0) setBonusMalusById({});
      return;
    }
    let cancelled = false;
    const ids = trolls.map((t) => t.id).filter((id) => id != null && String(id).trim() !== '');
    if (ids.length === 0) {
      setBonusMalusById({});
      return;
    }
    (async () => {
      try {
        const res = await api.getBtBonusMalus(ids);
        if (!cancelled) setBonusMalusById(res.by_troll_id || {});
      } catch {
        if (!cancelled) setBonusMalusById({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [trolls, loading]);

  const fetchGroupTrolls = async () => {
    try {
      setLoading(true);
      setError('');
      setBonusMalusById({});
      const data = await api.getBtGroup();
      setTrolls(normalizeBtTrolls(data));
    } catch (err) {
      setError(err.message || 'Failed to fetch BT group');
      setTrolls([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });

    const sortedTrolls = [...trolls].sort((a, b) => {
      let aVal;
      let bVal;

      if (key === 'Tröll') {
        aVal = a.nom;
        bVal = b.nom;
      } else if (key === 'PV') {
        aVal = a.pdv ?? a.pv;
        bVal = b.pdv ?? b.pv;
      } else if (key === 'Position') {
        aVal = a.pos_x ?? a.x;
        bVal = b.pos_x ?? b.x;
      } else if (key === 'PA') {
        aVal = a.pa;
        bVal = b.pa;
      } else if (key === 'DLA') {
        aVal = a.dla;
        bVal = b.dla;
      } else {
        aVal = a[key];
        bVal = b[key];
      }

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setTrolls(sortedTrolls);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const preferredColumns = ['Tröll', 'PA', 'PV', 'DLA', 'Position'];

  const hiddenColumns = [
    'id',
    'pdv',
    'pdv_max',
    'pv',
    'pv_max',
    'pos_n',
    'pos_x',
    'pos_y',
    'x',
    'y',
    'n',
    'caracs',
    'nom',
    'pa',
    'dla',
    'camoufle',
    'invisible',
    'niveau',
    'race',
    'updated_at',
  ];

  const getPVPercentage = (troll) => {
    const cur = troll.pdv ?? troll.pv;
    const max = troll.pdv_max ?? troll.pv_max;
    if (max != null && max > 0 && cur != null) {
      return (cur / max) * 100;
    }
    return null;
  };

  const getCellValue = (troll, key) => {
    if (key === 'Tröll') {
      return troll.nom != null ? troll.nom : '-';
    }
    if (key === 'PV') {
      const cur = troll.pdv ?? troll.pv;
      const max = troll.pdv_max ?? troll.pv_max;
      const pdv = cur != null ? cur : '-';
      const pdvMax = max != null ? max : '-';
      return `${pdv}/${pdvMax}`;
    }
    if (key === 'Position') {
      const posX = troll.pos_x ?? troll.x;
      const posY = troll.pos_y ?? troll.y;
      const posN = troll.pos_n ?? troll.n;
      const x = posX != null ? posX : '-';
      const y = posY != null ? posY : '-';
      const n = posN != null ? posN : '-';
      return `X= ${x} | Y= ${y} | N= ${n}`;
    }
    if (key === 'PA') {
      return troll.pa != null ? String(troll.pa) : '-';
    }
    if (key === 'DLA') {
      const dla = troll.dla;
      if (dla == null) return '-';
      return String(dla).replace(/:00$/, '');
    }
    return troll[key] != null ? String(troll[key]) : '-';
  };

  const columnExists = (key) => {
    if (key === 'Tröll') {
      return trolls.some((troll) => troll.nom != null);
    }
    if (key === 'PV') {
      return trolls.some(
        (troll) =>
          troll.pdv != null ||
          troll.pdv_max != null ||
          troll.pv != null ||
          troll.pv_max != null
      );
    }
    if (key === 'Position') {
      return trolls.some(
        (troll) =>
          troll.pos_x != null ||
          troll.pos_y != null ||
          troll.pos_n != null ||
          troll.x != null ||
          troll.y != null ||
          troll.n != null
      );
    }
    if (key === 'PA') {
      return trolls.some((troll) => troll.pa != null);
    }
    if (key === 'DLA') {
      return trolls.some((troll) => troll.dla != null);
    }
    return trolls.some((troll) => troll[key] != null);
  };

  const getAllKeys = () => {
    if (trolls.length === 0) return [];
    const keysSet = new Set();
    trolls.forEach((troll) => {
      Object.keys(troll).forEach((k) => keysSet.add(k));
    });

    const allKeys = Array.from(keysSet);
    const visibleKeys = allKeys.filter((key) => !hiddenColumns.includes(key));

    const combinedColumns = [];
    if (columnExists('Tröll')) combinedColumns.push('Tröll');
    if (columnExists('PV')) combinedColumns.push('PV');
    if (columnExists('PA')) combinedColumns.push('PA');
    if (columnExists('DLA')) combinedColumns.push('DLA');
    if (columnExists('Position')) combinedColumns.push('Position');

    const orderedKeys = [];
    const remainingKeys = [];

    preferredColumns.forEach((col) => {
      if (combinedColumns.includes(col)) orderedKeys.push(col);
    });

    visibleKeys.forEach((key) => {
      if (!preferredColumns.includes(key) && !combinedColumns.includes(key)) {
        remainingKeys.push(key);
      }
    });

    return [...orderedKeys, ...remainingKeys];
  };

  const handleNomClick = (e, troll) => {
    if (!troll.caracs) return;
    const rect = e.target.getBoundingClientRect();
    const trollId = troll.id != null ? troll.id : '-';
    let caracsContent = troll.caracs;

    if (typeof caracsContent === 'string') {
      caracsContent = caracsContent.replace(/^"/, '').replace(/"$/, '');
      caracsContent = caracsContent.replace(/\\n/g, '\n');
    } else {
      caracsContent = JSON.stringify(caracsContent, null, 2);
      caracsContent = caracsContent.replace(/^"/, '').replace(/"$/, '');
      caracsContent = caracsContent.replace(/\\n/g, '\n');
    }

    setTooltip({
      show: true,
      content: caracsContent,
      title: `Caracs: [${trollId}]`,
      x: rect.left + rect.width / 2,
      y: rect.bottom + 10,
    });
  };

  const handleCloseTooltip = () => {
    setTooltip({ show: false, content: '', title: '', x: 0, y: 0 });
  };

  const toggleCardExpanded = (cardId) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const toggleBonusMalusExpanded = useCallback((cardId) => {
    setExpandedBonusMalusCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }, []);

  const renderStarButton = (troll, extraClass = '') => {
    const sid = String(troll.id);
    const starred = starredIds.has(sid);
    return (
      <button
        type="button"
        className={`bt-star-btn ${starred ? 'bt-star-btn-active' : ''} ${extraClass}`.trim()}
        aria-label={starred ? 'Remove from favourites' : 'Add to favourites'}
        aria-pressed={starred}
        title={starred ? 'Remove from favourites' : 'Add to favourites'}
        onClick={(e) => {
          e.stopPropagation();
          toggleStar(troll.id);
        }}
      >
        {starred ? '⭐' : '☆'}
      </button>
    );
  };

  const renderHeaderActions = () => (
    <div className="group-header-actions">
      <button
        type="button"
        className="btn-filter-starred"
        onClick={toggleStarredFilter}
        aria-pressed={showStarredOnly}
        title={showStarredOnly ? 'Show all trolls' : 'Show starred trolls only'}
      >
        {showStarredOnly ? 'Show all' : 'Starred only'}
      </button>
      <button
        type="button"
        onClick={fetchGroupTrolls}
        className="btn-refresh-icon"
        aria-label="Refresh"
        title="Refresh"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="group-page">
        <div className="loading-spinner">Loading BT group data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-page">
        <h2>BT Group</h2>
        <div className="error-message">{error}</div>
        <button type="button" onClick={fetchGroupTrolls} className="btn btn-primary">
          Retry
        </button>
      </div>
    );
  }

  if (trolls.length === 0) {
    return (
      <div className="group-page">
        <h2>BT Group</h2>
        <p>No trolls found in your group.</p>
        <button type="button" onClick={fetchGroupTrolls} className="btn btn-primary">
          Refresh
        </button>
      </div>
    );
  }

  const sortedKeys = getAllKeys();

  if (displayTrolls.length === 0 && showStarredOnly) {
    return (
      <div className="group-page">
        <div className="group-header">
          <h2>BT Group</h2>
          {renderHeaderActions()}
        </div>
        <p>No starred trolls in the current group data.</p>
        <button type="button" onClick={showAllTrolls} className="btn btn-primary">
          Show all trolls
        </button>
      </div>
    );
  }

  return (
    <div className="group-page">
      <div className="group-header">
        <h2>BT Group</h2>
        {renderHeaderActions()}
      </div>

      <div className="group-container">
        <div className="table-view">
          <div className="table-container">
            <table className="group-table">
              <thead>
                <tr>
                  <th className="bt-star-col" scope="col" aria-label="Favourite">
                    ★
                  </th>
                  {sortedKeys.map((key) => (
                    <th
                      key={key}
                      onClick={() => handleSort(key)}
                      className={sortConfig.key === key ? 'sorted' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      {key}
                      <span className="sort-icon">{getSortIcon(key)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayTrolls.map((troll, index) => {
                  const pvPercentage = getPVPercentage(troll);
                  let nameBoxClass = 'name-box-gray';
                  if (pvPercentage !== null) {
                    if (pvPercentage > 80) nameBoxClass = 'name-box-green';
                    else if (pvPercentage >= 40) nameBoxClass = 'name-box-yellow';
                    else nameBoxClass = 'name-box-red';
                  }

                  const paValue = troll.pa != null ? Number(troll.pa) : null;
                  const isPA6 = paValue === 6;

                  return (
                    <tr key={troll.id ?? index}>
                      <td className="bt-star-col">{renderStarButton(troll)}</td>
                      {sortedKeys.map((key) => {
                        const isTrollColumn = key === 'Tröll';
                        const isPAColumn = key === 'PA';

                        return (
                          <td key={key}>
                            {isTrollColumn ? (
                              troll.caracs ? (
                                <span
                                  className={`troll-name-clickable ${nameBoxClass}`}
                                  onClick={(e) => handleNomClick(e, troll)}
                                  style={{ cursor: 'pointer', textDecoration: 'underline' }}
                                  role="presentation"
                                >
                                  {getCellValue(troll, key)}
                                </span>
                              ) : (
                                <span className={nameBoxClass}>{getCellValue(troll, key)}</span>
                              )
                            ) : isPAColumn ? (
                              <span className="bt-pa-eye-cluster">
                                <BtPaVisibilityEye troll={troll} />
                                <span className={isPA6 ? 'name-box-green' : 'name-box-gray'}>
                                  {getCellValue(troll, key)}
                                </span>
                              </span>
                            ) : (
                              getCellValue(troll, key)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="cards-view">
          {displayTrolls.map((troll, index) => {
            const pvPercentage = getPVPercentage(troll);
            let nameBoxClass = 'name-box-gray';
            if (pvPercentage !== null) {
              if (pvPercentage > 80) nameBoxClass = 'name-box-green';
              else if (pvPercentage >= 40) nameBoxClass = 'name-box-yellow';
              else nameBoxClass = 'name-box-red';
            }
            const paValue = troll.pa != null ? Number(troll.pa) : null;
            const isPA6 = paValue === 6;
            const cardId = String(troll.id ?? index);
            const isExpanded = expandedCardIds.has(cardId);

            return (
              <div key={cardId} className={`group-troll-card ${isExpanded ? 'group-troll-card-expanded' : ''}`}>
                <div
                  className="card-header group-card-header-tappable"
                  onClick={() => toggleCardExpanded(cardId)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleCardExpanded(cardId);
                    }
                  }}
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? 'Replier les détails' : 'Déplier les détails'}
                >
                  {renderStarButton(troll, 'bt-star-btn-card')}
                  <span className={nameBoxClass}>{troll.id ?? '-'}</span>
                  {troll.caracs ? (
                    <button
                      type="button"
                      className="group-troll-name-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNomClick(e, troll);
                      }}
                    >
                      {getCellValue(troll, 'Tröll')}
                    </button>
                  ) : (
                    <span className="group-troll-name">{getCellValue(troll, 'Tröll')}</span>
                  )}
                  <div className="group-card-pa bt-pa-eye-cluster">
                    <BtPaVisibilityEye troll={troll} />
                    <span className={isPA6 ? 'name-box-green' : 'name-box-gray'}>
                      {getCellValue(troll, 'PA')}
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  {sortedKeys.filter((k) => k !== 'Tröll' && k !== 'PA').map((key) => {
                    const bm = bonusMalusById[String(troll.id)];
                    return (
                      <div key={key}>
                        <div className="stat-row stat-row-dense">
                          <span className="stat-label">{key}</span>
                          <span>{getCellValue(troll, key)}</span>
                        </div>
                        {key === 'Position' && bm && (
                          <div className="bt-bonus-malus">
                            <button
                              type="button"
                              className="bt-bonus-malus-header"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleBonusMalusExpanded(cardId);
                              }}
                              aria-expanded={expandedBonusMalusCardIds.has(cardId)}
                            >
                              <span className="bt-bonus-malus-title">{bm.title}</span>
                              <span className="bt-bonus-malus-chevron" aria-hidden>
                                {expandedBonusMalusCardIds.has(cardId) ? '▼' : '▶'}
                              </span>
                            </button>
                            {expandedBonusMalusCardIds.has(cardId) && bm.items?.length > 0 && (
                              <ul className="bt-bonus-malus-list">
                                {bm.items.map((line, idx) => (
                                  <li key={idx}>{line}</li>
                                ))}
                              </ul>
                            )}
                            {expandedBonusMalusCardIds.has(cardId) && (!bm.items || bm.items.length === 0) && (
                              <p className="bt-bonus-malus-empty">Aucune entrée</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {tooltip.show && (
        <>
          <div className="tooltip-overlay" onClick={handleCloseTooltip} role="presentation"></div>
          <div
            className="tooltip"
            style={{
              left: `${tooltip.x}px`,
              top: `${tooltip.y}px`,
            }}
          >
            <div className="tooltip-header">
              <span>{tooltip.title || 'Caracs'}</span>
              <button type="button" className="tooltip-close" onClick={handleCloseTooltip}>×</button>
            </div>
            <div className="tooltip-content">
              {tooltip.content.split('\n').map((line, idx) => (
                <div key={idx}>{line || '\u00A0'}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BtGroup;
