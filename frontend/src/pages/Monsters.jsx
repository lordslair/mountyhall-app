import { useState, useEffect } from 'react';
import { api } from '../services/api';

const Monsters = () => {
  const [monsters, setMonsters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });

  useEffect(() => {
    fetchMonsters();
  }, []);

  // Auto-dismiss notification after 5 seconds
  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => {
        setNotification({ show: false, type: '', message: '' });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification.show]);

  const fetchMonsters = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.getMonsters();
      
      if (Array.isArray(data)) {
        setMonsters(data);
      } else {
        setMonsters([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch monsters');
      setMonsters([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    const mobId = searchInput.trim();
    
    if (!mobId) {
      setError('Entrez un ID de monstre');
      return;
    }

    // Validate numeric ID
    if (!/^\d+$/.test(mobId)) {
      setError('L\'ID de monstre doit être numérique');
      return;
    }

    try {
      setSearching(true);
      setError('');
      await api.searchMonster(mobId);
      
      // Refresh the monsters list
      await fetchMonsters();
      
      // Clear search input
      setSearchInput('');
    } catch (err) {
      setError(err.message || 'Failed to search monster');
    } finally {
      setSearching(false);
    }
  };

  const handleFetchMZ = async (mobId) => {
    try {
      setError('');
      const response = await api.fetchMZData(mobId);
      
      if (response.success) {
        // Show success notification
        setNotification({
          show: true,
          type: 'success',
          message: 'Ce monstre a bien été trouvé dans MZ'
        });
        
        // Refresh the monsters list to show updated data
        await fetchMonsters();
      } else {
        // Show failure notification
        setNotification({
          show: true,
          type: 'error',
          message: 'Ce monstre n\'a pas été trouvé dans MZ'
        });
      }
    } catch (err) {
      // Show failure notification
      setNotification({
        show: true,
        type: 'error',
        message: 'Ce monstre n\'a pas été trouvé dans MZ'
      });
    }
  };

  const getLevelDisplay = (monster) => {
    if (!monster.mob_json || typeof monster.mob_json !== 'object') {
      return '-';
    }
    
    const niv = monster.mob_json.niv;
    if (!niv) {
      return '-';
    }
    
    const min = niv.min;
    const max = niv.max;
    
    if (min === max) {
      return String(min);
    }
    
    return `${min} - ${max}`;
  };

  /**
   * @param {Object} monster - The monster data object
   * @param {boolean} includeBless - Whether to apply the injury (bless) percentage
   */
  const getPVDisplay = (monster, includeBless = true) => {
    if (!monster.mob_json || typeof monster.mob_json !== 'object') {
      return '-';
    }
    
    const pv = monster.mob_json.pv;
    const bless = monster.mob_json.bless;
    
    if (!pv) {
      return '-';
    }
    
    const pvMin = pv.min;
    const pvMax = pv.max;
    
    // Check both the parameter AND the existence of a bless value
    if (includeBless && bless > 0) {
      const calculatedMin = Math.round(pvMin * bless / 100);
      const calculatedMax = Math.round(pvMax * bless / 100);
      return `~ ${calculatedMin} - ${calculatedMax}`;
    } else {
      // Return standard stats if includeBless is false OR bless is 0/missing
      if (pvMin === pvMax) {
        return String(pvMin);
      }
      return `${pvMin} - ${pvMax}`;
    }
  };

  const getESQDisplay = (monster) => {
    if (!monster.mob_json || typeof monster.mob_json !== 'object') {
      return '-';
    }
    
    const esq = monster.mob_json.esq;
    if (!esq) {
      return '-';
    }
    
    const min = esq.min;
    const max = esq.max;
    
    if (min === max) {
      return String(min);
    }
    
    return `${min} - ${max}`;
  };

  const getArmPDisplay = (monster) => {
    if (!monster.mob_json || typeof monster.mob_json !== 'object') {
      return '-';
    }
    
    const arm = monster.mob_json.arm;
    if (!arm) {
      return '-';
    }
    
    const min = arm.min || 1;
    const max = arm.max;
    
    if (min === max) {
      return String(min);
    }
    
    return `${min} - ${max}`;
  };

  const getArmMDisplay = (monster) => {
    if (!monster.mob_json || typeof monster.mob_json !== 'object') {
      return '-';
    }
    
    const armM = monster.mob_json.armM;
    if (!armM) {
      return '-';
    }
    
    const min = armM.min || 1;
    const max = armM.max;
    
    if (min === max) {
      return String(min);
    }
    
    return `${min} - ${max}`;
  };

  const getNameBoxClass = (monster) => {
    if (!monster.mob_json || typeof monster.mob_json !== 'object') {
      return 'name-box-gray';
    }
    
    const mode = monster.mob_json.Mode;
    const bless = monster.mob_json.bless;
    
    // First check: if Mode is 'stat', return gray
    if (mode === 'stat') {
      return 'name-box-gray';
    }
    
    // Otherwise, check bless value
    if (bless == null || bless === undefined) {
      return 'name-box-gray';
    }
    
    if (bless < 20) {
      return 'name-box-green';
    } else if (bless >= 20 && bless < 80) {
      return 'name-box-yellow';
    } else if (bless >= 80) {
      return 'name-box-red';
    }
    
    return 'name-box-gray';
  };

  const handleCloseNotification = () => {
    setNotification({ show: false, type: '', message: '' });
  };

  const handlePurge = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer tous les monstres ? Cette action est irréversible.')) {
      return;
    }

    try {
      setError('');
      const response = await api.purgeMonsters();
      
      // Refresh the monsters list
      await fetchMonsters();
      
      // Show success notification
      setNotification({
        show: true,
        type: 'success',
        message: `Tous les monstres ont été supprimés (${response.count || 0} monstre(s))`
      });
    } catch (err) {
      setNotification({
        show: true,
        type: 'error',
        message: err.message || 'Échec de la suppression des monstres'
      });
    }
  };

  const handleDeleteMonster = async (mobId) => {
    if (!window.confirm('Êtes-vous sûr de vouloir supprimer ce monstre ?')) {
      return;
    }

    try {
      setError('');
      // Optimistic update - remove from UI immediately
      setMonsters(prevMonsters => prevMonsters.filter(m => m.mob_id !== mobId));
      
      await api.deleteMonster(mobId);
      
      // Show success notification
      setNotification({
        show: true,
        type: 'success',
        message: 'Monstre supprimé avec succès'
      });
    } catch (err) {
      // Revert optimistic update on error
      await fetchMonsters();
      setNotification({
        show: true,
        type: 'error',
        message: err.message || 'Échec de la suppression du monstre'
      });
    }
  };

  const formatTimegmt = (monster) => {
    if (!monster.mob_json || typeof monster.mob_json !== 'object') {
      return null;
    }
    
    const timegmt = monster.mob_json.timegmt;
    if (!timegmt) {
      return null;
    }
    
    try {
      // Try parsing as Unix timestamp (seconds)
      let date;
      if (typeof timegmt === 'number') {
        // If it's a number, check if it's seconds or milliseconds
        date = timegmt < 10000000000 ? new Date(timegmt * 1000) : new Date(timegmt);
      } else if (typeof timegmt === 'string') {
        // Try parsing as number first
        const num = parseInt(timegmt, 10);
        if (!isNaN(num)) {
          date = num < 10000000000 ? new Date(num * 1000) : new Date(num);
        } else {
          // Try parsing as ISO string
          date = new Date(timegmt);
        }
      } else {
        return null;
      }
      
      if (isNaN(date.getTime())) {
        return null;
      }
      
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      
      return `@ ${day}/${month} ${hours}:${minutes}\n Initial: ${getPVDisplay(monster, false)}`;
    } catch (e) {
      return null;
    }
  };

  if (loading) {
    return (
      <div className="group-page">
        <div className="loading-spinner">Loading monsters...</div>
      </div>
    );
  }

  return (
    <div className="group-page">
      <h2>Monstres 👹</h2>

      {/* Notification Banner */}
      {notification.show && (
        <div className={`notification-banner ${notification.type === 'success' ? 'notification-success' : 'notification-error'}`}>
          <span>{notification.message}</span>
          <button className="notification-close" onClick={handleCloseNotification}>×</button>
        </div>
      )}

      {/* Search Section */}
      <div className="monsters-search">
        <div className="search-input-group">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleSearch();
              }
            }}
            placeholder="ID du monstre"
            className="search-input"
            disabled={searching}
          />
          <button 
            onClick={handleSearch} 
            className="btn-search-icon"
            aria-label="Search"
            title="Search"
          >
            <svg 
              width="20" 
              height="20" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </button>
          <button 
            onClick={handlePurge} 
            className="btn-trash"
            aria-label="Purge"
            title="Supprimer tous les monstres"
          >
            Purge
          </button>
        </div>
        {error && <div className="error-message" style={{ marginTop: '1rem' }}>{error}</div>}
      </div>

      {/* Monsters Table */}
      {/* Monsters Content */}
      {monsters.length === 0 ? (
        <div style={{ marginTop: '2rem', textAlign: 'center', color: '#666' }}>
          <p>Aucun monstre trouvé.</p>
        </div>
      ) : (
        <div className="monsters-container" style={{ marginTop: '2rem' }}>
          
          {/* DESKTOP TABLE (Hidden on mobile) */}
          <div className="table-view">
            <table className="group-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Nom</th>
                  <th>Niv.</th>
                  <th>PV</th>
                  <th>ESQ</th>
                  <th>Arm.</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {monsters.map((monster) => {
                  return (
                    <tr key={monster.id}>
                      <td><span className={getNameBoxClass(monster)}>{monster.mob_id}</span></td>
                      <td>{monster.mob_name_full}</td>
                      <td>{getLevelDisplay(monster)}</td>
                      <td>{getPVDisplay(monster)}</td>
                      <td>{getESQDisplay(monster) === '-' 
                        ? '-' 
                        : <>{getESQDisplay(monster)} <b>D6</b></>
                      }</td>
                      <td>{getArmPDisplay(monster)} (<b>P</b>)| {getArmMDisplay(monster)} (<b>M</b>)</td>
                      <td>
                        <div className="action-buttons">
                          <button onClick={() => handleFetchMZ(monster.mob_id)} className="btn btn-secondary">🔎 MZ</button>
                          <button 
                            onClick={() => handleDeleteMonster(monster.mob_id)} 
                            className="btn-trash"
                            aria-label="Delete"
                            title="Supprimer ce monstre"
                          >
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="m19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS (Hidden on desktop) */}
          <div className="cards-view">
            {monsters.map((monster) => {
              const timegmtTooltip = formatTimegmt(monster);
              return (
                <div key={monster.id} className="monster-card">
                  <div className="card-header">
                    <span className={getNameBoxClass(monster)}>{monster.mob_id}</span>
                    <span className="monster-name">{monster.mob_name_full}</span>
                  </div>
                  
                  <div className="card-body">
                    <div className="stat-row">
                      <span><strong>Niveau:</strong> {getLevelDisplay(monster)}</span>
                      
                      <span 
                        className={timegmtTooltip ? 'pv-card-tooltip-trigger' : ''}
                        data-tooltip={timegmtTooltip || undefined}
                        tabIndex="0" // This allows the element to hold 'focus' after a tap
                      >
                        <strong>PV:</strong> {getPVDisplay(monster)}
                        {timegmtTooltip && (
                          <svg 
                            className="info-icon-mobile"
                            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="16" x2="12" y2="12"></line>
                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                          </svg>
                        )}
                      </span>
                    </div>
                    <div className="stat-row">
                      <span><strong>ESQ:</strong> {getESQDisplay(monster) === '-' 
                        ? '-' 
                        : <>{getESQDisplay(monster)} <b>D6</b></>
                      }</span>
                    </div>
                    <div className="stat-row">
                      <span><strong>Arm:</strong> {getArmPDisplay(monster)} (<b>P</b>) | {getArmMDisplay(monster)} (<b>M</b>)</span>
                    </div>
                  </div>

                  <div className="card-footer">
                    <div className="card-action-buttons">
                      <button
                        onClick={() => handleFetchMZ(monster.mob_id)}
                        className="btn btn-secondary"
                      >
                        🔎 MZ Data
                      </button>
                      <button 
                        onClick={() => handleDeleteMonster(monster.mob_id)} 
                        className="btn-trash"
                        aria-label="Delete"
                        title="Supprimer ce monstre"
                      >
                        <svg 
                          width="16" 
                          height="16" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <polyline points="3 6 5 6 21 6"></polyline>
                          <path d="m19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Monsters;
