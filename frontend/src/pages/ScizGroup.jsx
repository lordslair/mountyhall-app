import { useState, useEffect, useMemo, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';

function starredStorageKey(userId) {
  return `mountyhapp_sciz_starred_ids_${userId}`;
}

function filterStorageKey(userId) {
  return `mountyhapp_sciz_starred_filter_${userId}`;
}

const ScizGroup = () => {
  const { user } = useAuth();
  const [trolls, setTrolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [tooltip, setTooltip] = useState({ show: false, content: '', title: '', x: 0, y: 0 });
  const [expandedCardIds, setExpandedCardIds] = useState(() => new Set());
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

  const fetchGroupTrolls = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getScizGroupTrolls();
      
      // Handle different response formats
      if (Array.isArray(data)) {
        setTrolls(data);
      } else if (data && Array.isArray(data.trolls)) {
        setTrolls(data.trolls);
      } else if (data && Array.isArray(data.data)) {
        setTrolls(data.data);
      } else {
        setTrolls([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch group trolls');
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
      let aVal, bVal;

      // Handle combined/renamed columns
      if (key === 'Tröll') {
        // Sort by name (nom)
        aVal = a.nom;
        bVal = b.nom;
      } else if (key === 'PV') {
        // Sort by pdv (first value)
        aVal = a.pdv;
        bVal = b.pdv;
      } else if (key === 'Position') {
        // Sort by pos_x (X coordinate)
        aVal = a.pos_x;
        bVal = b.pos_x;
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

      // Handle null/undefined values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Compare values
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      if (aStr < bStr) return direction === 'asc' ? -1 : 1;
      if (aStr > bStr) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    setTrolls(sortedTrolls);
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return '↕️';
    }
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  // Preferred column order (first columns)
  // Note: pdv, pdv_max will be combined into "PV"
  // pos_n, pos_x, pos_y will be combined into "Position"
  // id and nom will be combined into "Tröll"
  const preferredColumns = ['Tröll', 'PA', 'PV', 'DLA', 'Position'];
  
  // Columns to hide (including original columns that are now combined)
  const hiddenColumns = [
    'last_event_update_at',
    'last_profile_update_at',
    'statut',
    'guilde_id',
    'guilde_nom',
    'concentration',
    'pdv',        // Combined into PV
    'pdv_max',    // Combined into PV
    'pos_n',      // Combined into Position
    'pos_x',      // Combined into Position
    'pos_y',      // Combined into Position
    'caracs',     // Hidden (shown in tooltip)
    'fatigue',    // Hidden
    'niveau',     // Hidden
    'niv',        // Hidden
    'race',       // Hidden
    'id',         // Combined into Tröll
    'nom',        // Combined into Tröll
    'pa',         // Renamed to PA
    'dla'         // Renamed to DLA
  ];

  // Calculate PV percentage
  const getPVPercentage = (troll) => {
    if (troll.pdv_max != null && troll.pdv_max > 0 && troll.pdv != null) {
      return (troll.pdv / troll.pdv_max) * 100;
    }
    return null;
  };

  // Get cell value with transformations
  const getCellValue = (troll, key) => {
    // Handle combined columns
    if (key === 'Tröll') {
      const nom = troll.nom != null ? troll.nom : '-';
      return nom;
    }
    
    if (key === 'PV') {
      const pdv = troll.pdv != null ? troll.pdv : '-';
      const pdvMax = troll.pdv_max != null ? troll.pdv_max : '-';
      return `${pdv}/${pdvMax}`;
    }
    
    if (key === 'Position') {
      const posX = troll.pos_x != null ? troll.pos_x : '-';
      const posY = troll.pos_y != null ? troll.pos_y : '-';
      const posN = troll.pos_n != null ? troll.pos_n : '-';
      return `X= ${posX} | Y= ${posY} | N= ${posN}`;
    }
    
    // Handle renamed columns
    if (key === 'PA') {
      return troll.pa != null ? String(troll.pa) : '-';
    }
    
    if (key === 'DLA') {
      const dla = troll.dla;
      if (dla == null) return '-';
      const dlaStr = String(dla);
      // Remove ':00' from the end
      return dlaStr.replace(/:00$/, '');
    }
    
    // Regular column
    return troll[key] != null ? String(troll[key]) : '-';
  };

  // Check if column exists in data (including combined columns)
  const columnExists = (key) => {
    if (key === 'Tröll') {
      return trolls.some(troll => troll.id != null || troll.nom != null);
    }
    if (key === 'PV') {
      return trolls.some(troll => troll.pdv != null || troll.pdv_max != null);
    }
    if (key === 'Position') {
      return trolls.some(troll => troll.pos_x != null || troll.pos_y != null || troll.pos_n != null);
    }
    if (key === 'PA') {
      return trolls.some(troll => troll.pa != null);
    }
    if (key === 'DLA') {
      return trolls.some(troll => troll.dla != null);
    }
    return trolls.some(troll => troll[key] != null);
  };

  // Get all unique keys from trolls data, ordered correctly
  const getAllKeys = () => {
    if (trolls.length === 0) return [];
    const keysSet = new Set();
    trolls.forEach(troll => {
      Object.keys(troll).forEach(key => keysSet.add(key));
    });
    
    const allKeys = Array.from(keysSet);
    
    // Filter out hidden columns
    const visibleKeys = allKeys.filter(key => !hiddenColumns.includes(key));
    
    // Add combined/renamed columns if their source columns exist
    const combinedColumns = [];
    if (columnExists('Tröll')) {
      combinedColumns.push('Tröll');
    }
    if (columnExists('PV')) {
      combinedColumns.push('PV');
    }
    if (columnExists('PA')) {
      combinedColumns.push('PA');
    }
    if (columnExists('DLA')) {
      combinedColumns.push('DLA');
    }
    if (columnExists('Position')) {
      combinedColumns.push('Position');
    }
    
    // Order: preferred columns first (in order), then remaining columns
    const orderedKeys = [];
    const remainingKeys = [];
    
    preferredColumns.forEach(col => {
      if (combinedColumns.includes(col)) {
        orderedKeys.push(col);
      }
    });
    
    visibleKeys.forEach(key => {
      if (!preferredColumns.includes(key) && !combinedColumns.includes(key)) {
        remainingKeys.push(key);
      }
    });
    
    return [...orderedKeys, ...remainingKeys];
  };

  const handleNomClick = (e, troll) => {
    if (troll.caracs) {
      const rect = e.target.getBoundingClientRect();
      const trollId = troll.id != null ? troll.id : '-';
      let caracsContent = troll.caracs;
      
      // If caracs is a string, process it
      if (typeof caracsContent === 'string') {
        // Remove double quotes at beginning and end
        caracsContent = caracsContent.replace(/^"/, '').replace(/"$/, '');
        // Replace \n with actual newlines (unescape)
        caracsContent = caracsContent.replace(/\\n/g, '\n');
      } else {
        // If it's an object, convert to string and process
        caracsContent = JSON.stringify(caracsContent, null, 2);
        caracsContent = caracsContent.replace(/^"/, '').replace(/"$/, '');
        caracsContent = caracsContent.replace(/\\n/g, '\n');
      }
      
      setTooltip({
        show: true,
        content: caracsContent,
        title: `Caracs: [${trollId}]`,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 10
      });
    }
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
        <div className="loading-spinner">Loading SCIZ group data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-page">
        <h2>SCIZ Group</h2>
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
        <h2>SCIZ Group</h2>
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
          <h2>SCIZ Group</h2>
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
        <h2>SCIZ Group</h2>
        {renderHeaderActions()}
      </div>

      <div className="group-container">
        {/* DESKTOP TABLE (Hidden on mobile) */}
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
                  
                  // Determine Troll name box color based on PV percentage
                  let nameBoxClass = '';
                  if (pvPercentage !== null) {
                    if (pvPercentage > 80) {
                      nameBoxClass = 'name-box-green';
                    } else if (pvPercentage >= 40) {
                      nameBoxClass = 'name-box-yellow';
                    } else {
                      nameBoxClass = 'name-box-red';
                    }
                  } else {
                    // Gray box when PV percentage can't be calculated
                    nameBoxClass = 'name-box-gray';
                  }
                  
                  // Check if PA is 6 (handle both string and integer)
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
                                >
                                  {getCellValue(troll, key)}
                                </span>
                              ) : (
                                <span className={nameBoxClass}>
                                  {getCellValue(troll, key)}
                                </span>
                              )
                            ) : isPAColumn ? (
                              <span className={isPA6 ? 'name-box-green' : 'name-box-gray'}>
                                {getCellValue(troll, key)}
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

        {/* MOBILE CARDS (Hidden on desktop) */}
        <div className="cards-view">
          {displayTrolls.map((troll, index) => {
            const pvPercentage = getPVPercentage(troll);
            let nameBoxClass = '';
            if (pvPercentage !== null) {
              if (pvPercentage > 80) {
                nameBoxClass = 'name-box-green';
              } else if (pvPercentage >= 40) {
                nameBoxClass = 'name-box-yellow';
              } else {
                nameBoxClass = 'name-box-red';
              }
            } else {
              nameBoxClass = 'name-box-gray';
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
                      onClick={(e) => { e.stopPropagation(); handleNomClick(e, troll); }}
                    >
                      {getCellValue(troll, 'Tröll')}
                    </button>
                  ) : (
                    <span className="group-troll-name">{getCellValue(troll, 'Tröll')}</span>
                  )}
                  <span className={`group-card-pa ${isPA6 ? 'name-box-green' : 'name-box-gray'}`}>
                    {getCellValue(troll, 'PA')}
                  </span>
                </div>
                <div className="card-body">
                  {sortedKeys.filter(k => k !== 'Tröll' && k !== 'PA').map((key) => {
                    const value = getCellValue(troll, key);
                    return (
                      <div key={key} className="stat-row stat-row-dense">
                        <span className="stat-label">{key}</span>
                        <span>{value}</span>
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
          <div
            className="tooltip-overlay"
            onClick={handleCloseTooltip}
          ></div>
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
              {tooltip.content.split('\n').map((line, index) => (
                <div key={index}>{line || '\u00A0'}</div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ScizGroup;
