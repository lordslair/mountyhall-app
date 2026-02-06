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

  const getPVDisplay = (monster) => {
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
    
    if (bless > 0) {
      const calculatedMin = Math.round(pvMin * bless / 100);
      const calculatedMax = Math.round(pvMax * bless / 100);
      return `~ ${calculatedMin} - ${calculatedMax}`;
    } else {
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
    
    const min = arm.min;
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
    
    const min = armM.min;
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
            className="btn btn-primary"
            disabled={searching}
            style={{ marginLeft: '0.5rem', width: 'auto', minWidth: '150px' }}
          >
            {searching ? 'Recherche...' : 'Recherche Monstre'}
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
                  <th>ArmP</th>
                  <th>ArmM</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {monsters.map((monster) => (
                <tr key={monster.id}>
                    <td><span className={getNameBoxClass(monster)}>{monster.mob_id}</span></td>
                    <td>{monster.mob_name_full}</td>
                  <td>{getLevelDisplay(monster)}</td>
                    <td>{getPVDisplay(monster)}</td>
                    <td>{getESQDisplay(monster)}</td>
                    <td>{getArmPDisplay(monster)}</td>
                    <td>{getArmMDisplay(monster)}</td>
                  <td>
                      <button onClick={() => handleFetchMZ(monster.mob_id)} className="btn btn-secondary">🔎 MZ</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          {/* MOBILE CARDS (Hidden on desktop) */}
          <div className="cards-view">
            {monsters.map((monster) => (
              <div key={monster.id} className="monster-card">
                <div className="card-header">
                  <span className={getNameBoxClass(monster)}>{monster.mob_id}</span>
                  <span className="monster-name">{monster.mob_name_full}</span>
                </div>
                
                <div className="card-body">
                  <div className="stat-row">
                    <span><strong>Niveau:</strong> {getLevelDisplay(monster)}</span>
                    <span><strong>PV:</strong> {getPVDisplay(monster)}</span>
                  </div>
                  <div className="stat-row">
                    <span><strong>ESQ:</strong> {getESQDisplay(monster)}</span>
                    <span><strong>ArmP:</strong> {getArmPDisplay(monster)}</span>
                  </div>
                  <div className="stat-row">
                    <span><strong>ArmM:</strong> {getArmMDisplay(monster)}</span>
                  </div>
                </div>

                <div className="card-footer">
                  <button
                    onClick={() => handleFetchMZ(monster.mob_id)}
                    className="btn btn-secondary btn-full"
                  >
                    🔎 MZ Data
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Monsters;
