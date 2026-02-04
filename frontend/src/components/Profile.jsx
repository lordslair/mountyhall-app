import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [trollId, setTrollId] = useState('');
  const [trollName, setTrollName] = useState('');
  const [scizToken, setScizToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setTrollId(user.troll_id || '');
      setTrollName(user.troll_name || '');
      setScizToken(user.sciz_token || '');
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    const updates = {};
    if (trollId !== (user?.troll_id || '')) updates.troll_id = trollId || null;
    // troll_name is auto-fetched by backend when troll_id changes, so we don't send it
    if (scizToken !== (user?.sciz_token || '')) updates.sciz_token = scizToken || null;

    if (Object.keys(updates).length === 0) {
      setMessage('No changes to save');
      setLoading(false);
      return;
    }

    const result = await updateProfile(updates);
    
    if (result.success) {
      setMessage('Profile updated successfully!');
      // User state is automatically updated in AuthContext, which will trigger
      // the useEffect hook to update local state (including troll_name)
    } else {
      setError(result.error || 'Failed to update profile');
      // On error, reset trollId to the original value from user state
      // so the form shows the correct (unsaved) value
      if (user) {
        setTrollId(user.troll_id || '');
        setTrollName(user.troll_name || '');
      }
    }
    
    setLoading(false);
  };


  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div className="profile-container">
      <h2>Profile</h2>
      
      <div className="profile-info">
        <div className="info-item">
          <label>Email:</label>
          <span>{user.email}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="profile-form">
        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <div className="form-group">
          <label htmlFor="troll-id">Troll ID</label>
          <input
            id="troll-id"
            type="text"
            value={trollId}
            onChange={(e) => setTrollId(e.target.value)}
            placeholder="Enter your troll ID"
          />
        </div>

        <div className="form-group">
          <label htmlFor="troll-name">Troll Name</label>
          <input
            id="troll-name"
            type="text"
            value={trollName}
            readOnly
            disabled
            placeholder="Auto-fetched from MountyHall when Troll ID is set"
            className="read-only-input"
          />
          <small className="form-hint">Troll name is automatically fetched from MountyHall when you set your Troll ID</small>
        </div>

        <div className="form-group">
          <label htmlFor="sciz-token">Sciz Token</label>
          <input
            id="sciz-token"
            type="text"
            value={scizToken}
            onChange={(e) => setScizToken(e.target.value)}
            placeholder="Enter your sciz token"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Profile;
