import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';
import type { Staff } from '../types';

interface AuthState {
  isAuthenticated: boolean;
  user: Staff | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (user: Staff) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    loading: true,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await api.get<any>('/api/auth/me');
      if (res.success && res.user) {
        setState({
          isAuthenticated: true,
          user: res.user,
          loading: false,
        });
      } else {
        setState({ isAuthenticated: false, user: null, loading: false });
      }
    } catch (error) {
      setState({ isAuthenticated: false, user: null, loading: false });
    }
  };

  const login = (user: Staff) => {
    setState({ isAuthenticated: true, user, loading: false });
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (e) {} // ignore
    setState({ isAuthenticated: false, user: null, loading: false });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
