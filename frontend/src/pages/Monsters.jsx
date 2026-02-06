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
      setError('Please enter a monster ID');
      return;
    }

    // Validate numeric ID
    if (!/^\d+$/.test(mobId)) {
      setError('Monster ID must be numeric');
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
      {monsters.length === 0 ? (
        <div style={{ marginTop: '2rem', textAlign: 'center', color: '#666' }}>
          <p>Aucun monstre trouvé. Utilisez le champ de recherche ci-dessus pour ajouter un monstre.</p>
        </div>
      ) : (
        <div className="table-container" style={{ marginTop: '2rem' }}>
          <table className="group-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Nom</th>
                <th>Niv.</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {monsters.map((monster) => (
                <tr key={monster.id}>
                  <td>{monster.mob_id}</td>
                  <td>{monster.mob_name_full || '-'}</td>
                  <td>{getLevelDisplay(monster)}</td>
                  <td>
                    <button
                      onClick={() => handleFetchMZ(monster.mob_id)}
                      className="btn btn-secondary"
                      style={{ width: 'auto', minWidth: '120px', padding: '0.5rem 1rem' }}
                    >
                      Recherche MZ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Monsters;
