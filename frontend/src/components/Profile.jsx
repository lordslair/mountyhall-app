import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
  const { user, updateProfile } = useAuth();
  const [trollId, setTrollId] = useState('');
  const [trollName, setTrollName] = useState('');
  const [scizToken, setScizToken] = useState('');
  const [btSystem, setBtSystem] = useState('');
  const [btLogin, setBtLogin] = useState('');
  const [btPassword, setBtPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setTrollId(user.troll_id || '');
      setTrollName(user.troll_name || '');
      setScizToken(user.sciz_token || '');
      setBtSystem(user.bt_system || '');
      setBtLogin(user.bt_login || '');
      setBtPassword(user.bt_password || '');
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
    if (btSystem !== (user?.bt_system || '')) updates.bt_system = btSystem || null;
    if (btLogin !== (user?.bt_login || '')) updates.bt_login = btLogin || null;
    if (btPassword !== (user?.bt_password || '')) updates.bt_password = btPassword || null;

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
        setScizToken(user.sciz_token || '');
        setBtSystem(user.bt_system || '');
        setBtLogin(user.bt_login || '');
        setBtPassword(user.bt_password || '');
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

        <h3 className="profile-section-title">Bricol&apos;Trolls (BT)</h3>

        <div className="form-group">
          <label htmlFor="bt-system">Nom du système</label>
          <input
            id="bt-system"
            type="text"
            value={btSystem}
            onChange={(e) => setBtSystem(e.target.value)}
            placeholder="Nom du système"
          />
        </div>

        <div className="form-group">
          <label htmlFor="bt-login">Compte</label>
          <input
            id="bt-login"
            type="text"
            value={btLogin}
            onChange={(e) => setBtLogin(e.target.value)}
            placeholder="Compte"
          />
        </div>

        <div className="form-group">
          <label htmlFor="bt-password">Password</label>
          <input
            id="bt-password"
            type="password"
            value={btPassword}
            onChange={(e) => setBtPassword(e.target.value)}
            placeholder="Password"
            autoComplete="new-password"
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
