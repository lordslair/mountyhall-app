import { useState, useEffect } from 'react';
import { api } from '../services/api';

const BtGroup = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const res = await api.getBtGroup();
        setData(res);
      } catch (err) {
        setError(err.message || 'Failed to load BT group');
        setData(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="group-page">
        <div className="loading-spinner">Loading BT group...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="group-page">
        <h2>BT Group</h2>
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="group-page">
      <h2>BT Group</h2>
      <p>{data?.message || 'No data.'}</p>
    </div>
  );
};

export default BtGroup;
