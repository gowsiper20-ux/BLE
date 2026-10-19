import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { api } from '../services/api';
import type { Staff, UserRole } from '../types';
import { isMsalConfigured, msalInstance, loginRequest } from '../config/msalConfig';

interface AuthState {
  isAuthenticated: boolean;
  user: Staff | null;
  roles: UserRole[];
  loading: boolean;
}

interface AuthContextType extends AuthState {
  loginWithMicrosoft: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function isUserRole(role: string): role is UserRole {
  return ['ADMIN', 'HOD', 'DEPUTY_HOD', 'CLASS_COUNSELOR', 'STAFF', 'STUDENT'].includes(role);
}

function extractRoles(user: Staff | undefined): UserRole[] {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    return user.roles.filter(isUserRole);
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

  const checkAuth = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void Promise.resolve().then(checkAuth);
  }, [checkAuth]);

  const loginWithMicrosoft = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!isMsalConfigured() || loginRequest.scopes.length !== 1) {
        throw new Error('Microsoft sign-in is not configured. Set the tenant, SPA client, and backend API scope.');
      }

      const loginResponse = await msalInstance.loginPopup(loginRequest);
      if (!loginResponse.account) {
        throw new Error('Microsoft sign-in did not return an account.');
      }

      msalInstance.setActiveAccount(loginResponse.account);
      let accessToken: string;
      try {
        const tokenResponse = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: loginResponse.account,
        });
        accessToken = tokenResponse.accessToken;
      } catch (error) {
        if (!(error instanceof InteractionRequiredAuthError)) throw error;
        const tokenResponse = await msalInstance.acquireTokenPopup({
          ...loginRequest,
          account: loginResponse.account,
        });
        accessToken = tokenResponse.accessToken;
      }
      if (!accessToken) throw new Error('Microsoft did not issue an access token for the backend API.');

      const res = await api.post<{
        success: boolean;
        user: Staff;
        error?: { code?: string; message?: string };
      }>('/api/auth/microsoft', { token: accessToken });

      if (res.success && res.user) {
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Microsoft authentication was cancelled or failed.';
      return { success: false, error: message };
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
        loginWithMicrosoft,
        logout,
        hasRole,
        hasAnyRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
