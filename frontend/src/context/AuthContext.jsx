import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api, { TOKEN_KEY } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => setUser(res.data.data))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const handleAuth = (res) => {
    localStorage.setItem(TOKEN_KEY, res.data.data.token);
    setUser(res.data.data.user);
    return res.data.data.user;
  };

  const login = useCallback(async (email, password) => handleAuth(await api.post('/auth/login', { email, password })), []);
  const register = useCallback(async (payload) => handleAuth(await api.post('/auth/register', payload)), []);
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      setUser,
      loading,
      login,
      register,
      logout,
      isAdmin: user?.role === 'ADMIN',
      isManager: user?.role === 'PROJECT_MANAGER',
      canCreateProjects: user?.role === 'ADMIN' || user?.role === 'PROJECT_MANAGER',
      /** Mirrors the backend rule: admins, or the PM who manages the project. */
      canManage: (project) => !!user && (user.role === 'ADMIN' || (user.role === 'PROJECT_MANAGER' && project?.managerId === user.id)),
    }),
    [user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
