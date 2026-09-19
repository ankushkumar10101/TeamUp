import React, { createContext, useContext, useState, useEffect } from 'react';
import authService from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('teamup_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('teamup_token') || null);
  const [loading, setLoading] = useState(true);

  // Verify authentication on mount
  useEffect(() => {
    const verifyAuth = async () => {
      try {
        if (token) {
          const res = await authService.getMe();
          if (res.success && res.user) {
            setUser(res.user);
            localStorage.setItem('teamup_user', JSON.stringify(res.user));
          }
        }
      } catch (err) {
        console.warn('Auth verification failed:', err.response?.data?.message || err.message);
        setUser(null);
        setToken(null);
        localStorage.removeItem('teamup_user');
        localStorage.removeItem('teamup_token');
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, [token]);

  const login = async (email, password) => {
    const res = await authService.login(email, password);
    if (res.success) {
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem('teamup_user', JSON.stringify(res.user));
      localStorage.setItem('teamup_token', res.token);
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
  };

  const register = async (userData) => {
    const res = await authService.register(userData);
    if (res.success) {
      setUser(res.user);
      setToken(res.token);
      localStorage.setItem('teamup_user', JSON.stringify(res.user));
      localStorage.setItem('teamup_token', res.token);
      return res.user;
    }
    throw new Error(res.message || 'Registration failed');
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (err) {
      console.warn('Logout API warning:', err.message);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('teamup_user');
      localStorage.removeItem('teamup_token');
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
