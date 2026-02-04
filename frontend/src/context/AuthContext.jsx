import { createContext, useContext, useState, useEffect } from 'react';
import { api, getToken } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          const userData = await api.getProfile();
          setUser(userData);
        } catch (err) {
          // Token might be invalid, clear it
          localStorage.removeItem('token');
          setUser(null);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password) => {
    try {
      setError(null);
      await api.login(email, password);
      const userData = await api.getProfile();
      setUser(userData);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const register = async (email, password) => {
    try {
      setError(null);
      await api.register(email, password);
      // After registration, automatically log in
      return await login(email, password);
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (err) {
      // Even if logout fails, clear local state
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setError(null);
    }
  };

  const updateProfile = async (updates) => {
    try {
      setError(null);
      const updatedUser = await api.updateProfile(updates);
      setUser(updatedUser);
      return { success: true };
    } catch (err) {
      setError(err.message);
      return { success: false, error: err.message };
    }
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateProfile,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
