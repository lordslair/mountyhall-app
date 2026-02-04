import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const LoginForm = ({ onSwitchToRegister }) => {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');
    setLoading(true);

    const result = await login(email, password);
    
    if (!result.success) {
      setLocalError(result.error || 'Login failed');
    }
    
    setLoading(false);
  };

  const displayError = localError || error;

  return (
    <div className="auth-form">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        {displayError && <div className="error-message">{displayError}</div>}
        
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="your@email.com"
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      <p className="switch-form">
        Don't have an account?{' '}
        <button type="button" onClick={onSwitchToRegister} className="link-button">
          Register
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
