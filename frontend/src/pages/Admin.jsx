import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const Admin = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        setError('');
        const data = await api.getAdminMetrics();
        setMetrics(data);
      } catch (err) {
        setError(err.message || 'Failed to fetch metrics');
        setMetrics(null);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  const metricCards = metrics ? [
    {
      key: 'users_with_sciz',
      label: 'Users with SCIZ tokens',
      value: metrics.users_with_sciz,
      icon: '🔑',
      gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
    },
    {
      key: 'users_without_sciz',
      label: 'Users without SCIZ tokens',
      value: metrics.users_without_sciz,
      icon: '👤',
      gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    },
    {
      key: 'total_users',
      label: 'Total users',
      value: metrics.total_users,
      icon: '👥',
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    },
    {
      key: 'total_monsters',
      label: 'Total monsters',
      value: metrics.total_monsters,
      icon: '👹',
      gradient: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)',
    },
  ] : [];

  return (
    <div className="admin-page">
      <h2 className="admin-page-title">Admin Backoffice</h2>

      {loading && (
        <div className="admin-loading">Loading metrics...</div>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}

      {!loading && !error && metrics && (
        <div className="admin-metrics-grid">
          {metricCards.map((card) => (
            <div
              key={card.key}
              className="admin-metric-card"
              style={{ '--metric-gradient': card.gradient }}
            >
              <div className="admin-metric-icon">{card.icon}</div>
              <div className="admin-metric-value">{card.value}</div>
              <div className="admin-metric-label">{card.label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Admin;
