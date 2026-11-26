import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, setUnauthorizedHandler } from './api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');

  useEffect(() => {
    api('/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setNotice('Your session has ended. Please sign in again.');
    });
  }, []);

  const login = useCallback(async (email, password) => {
    const d = await api('/auth/login', { method: 'POST', body: { email, password } });
    setNotice('');
    setUser(d.user);
    return d.user;
  }, []);

  const register = useCallback(async (form) => {
    const d = await api('/auth/register', { method: 'POST', body: form });
    setNotice('');
    setUser(d.user);
    return d.user;
  }, []);

  const logout = useCallback(async (message = '') => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } catch {
      /* already signed out */
    }
    setUser(null);
    setNotice(message);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, notice, setNotice }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
