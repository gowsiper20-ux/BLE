import React, { createContext, useContext, useState, useEffect } from 'react';

type AuthState = 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED';

interface AuthContextData {
  authState: AuthState;
  user: any | null; // Replace with Staff type later
  login: (staffCode: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('UNAUTHENTICATED');
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    // In future phases: load from SecureStore
  }, []);

  const login = async (staffCode: string) => {
    setAuthState('AUTHENTICATING');
    try {
      // Mock development login logic
      if (process.env.EXPO_PUBLIC_DEV_LOGIN_MODE === 'true') {
        if (staffCode === 'DEV-STAFF-001') {
          setTimeout(() => {
            setUser({
              id: 'prof-123',
              name: 'Dr. Kumar',
              staffCode: 'STF-001',
              department: 'IT',
              role: 'STAFF'
            });
            setAuthState('AUTHENTICATED');
          }, 500);
          return;
        }
      }
      throw new Error('Invalid mock credentials');
    } catch (e) {
      setAuthState('UNAUTHENTICATED');
      throw e;
    }
  };

  const logout = async () => {
    setUser(null);
    setAuthState('UNAUTHENTICATED');
  };

  return (
    <AuthContext.Provider value={{ authState, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
