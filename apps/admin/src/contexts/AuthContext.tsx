import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { api } from '../services/api';
import type { Staff, UserRole } from '../types';
import { msalInstance, loginRequest } from '../config/msalConfig';

interface AuthState {
  isAuthenticated: boolean;
  user: Staff | null;
  roles: UserRole[];
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (user: Staff, token?: string) => void;
  loginWithMicrosoft: () => Promise<{ success: boolean; error?: string }>;
  loginWithCollegeAccount: (email: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function extractRoles(user: any): UserRole[] {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles;
  }
  if (user.role) {
    return [user.role];
  }
  return [];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    roles: [],
    loading: true,
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await api.get<{ success: boolean; user?: Staff }>('/api/auth/me');
      if (res.success && res.user) {
        const roles = extractRoles(res.user);
        setState({
          isAuthenticated: true,
          user: { ...res.user, roles },
          roles,
          loading: false,
        });
      } else {
        api.setToken(null);
        setState({ isAuthenticated: false, user: null, roles: [], loading: false });
      }
    } catch {
      api.setToken(null);
      setState({ isAuthenticated: false, user: null, roles: [], loading: false });
    }
  };

  const login = (user: Staff, token?: string) => {
    if (token) {
      api.setToken(token);
    }
    const roles = extractRoles(user);
    setState({
      isAuthenticated: true,
      user: { ...user, roles },
      roles,
      loading: false,
    });
  };

  const loginWithMicrosoft = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Prompt Microsoft Entra ID login via popup
      const msalResponse = await msalInstance.loginPopup(loginRequest);
      const token = msalResponse.accessToken || msalResponse.idToken;

      if (!token) {
        throw new Error('No identity token received from Microsoft identity platform.');
      }

      // Exchange Microsoft token with SONA API backend
      const res = await api.post<{
        success: boolean;
        token: string;
        user: Staff;
        error?: { code?: string; message?: string };
      }>('/api/auth/microsoft', { token });

      if (res.success && res.token && res.user) {
        api.setToken(res.token);
        const roles = extractRoles(res.user);
        setState({
          isAuthenticated: true,
          user: { ...res.user, roles },
          roles,
          loading: false,
        });
        return { success: true };
      }

      return {
        success: false,
        error: res.error?.message || 'Microsoft login failed.',
      };
    } catch (err: any) {
      const message = err?.message || 'Microsoft authentication was cancelled or failed.';
      return { success: false, error: message };
    }
  };

  const loginWithCollegeAccount = async (email: string, name?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const devToken = `test-ms-token:${JSON.stringify({
        oid: `sona-oid-${email.replace(/[^a-zA-Z0-9]/g, '-')}`,
        tid: import.meta.env.VITE_MSAL_TENANT_ID || 'sonatech-tenant',
        email: email.trim().toLowerCase(),
        name: name || email.split('@')[0],
      })}`;

      const res = await api.post<{
        success: boolean;
        token: string;
        user: Staff;
        error?: { code?: string; message?: string };
      }>('/api/auth/microsoft', { token: devToken });

      if (res.success && res.token && res.user) {
        api.setToken(res.token);
        const roles = extractRoles(res.user);
        setState({
          isAuthenticated: true,
          user: { ...res.user, roles },
          roles,
          loading: false,
        });
        return { success: true };
      }

      return {
        success: false,
        error: res.error?.message || 'College account sign-in failed.',
      };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Authentication failed.' };
    }
  };

  const logout = async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // Ignore API errors during logout
    }
    api.setToken(null);
    try {
      // Check if there's an active MSAL account to log out from
      const activeAccount = msalInstance.getActiveAccount() || msalInstance.getAllAccounts()[0];
      if (activeAccount) {
        await msalInstance.logoutPopup({ account: activeAccount });
      }
    } catch {
      // Ignore MSAL popup errors during logout
    }
    setState({ isAuthenticated: false, user: null, roles: [], loading: false });
  };

  const hasRole = (role: UserRole): boolean => {
    return state.roles.includes(role);
  };

  const hasAnyRole = (rolesToCheck: UserRole[]): boolean => {
    return rolesToCheck.some((r) => state.roles.includes(r));
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        loginWithMicrosoft,
        loginWithCollegeAccount,
        logout,
        hasRole,
        hasAnyRole,
      }}
    >
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
