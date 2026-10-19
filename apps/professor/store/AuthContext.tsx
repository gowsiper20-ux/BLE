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
      if (process.env.NODE_ENV === 'test') {
        if (staffCode === 'DEV-STAFF-001') {
          setUser({
            id: 'prof-123',
            name: 'Test Professor',
            staffCode: 'TEST-STAFF',
            department: 'TEST',
            role: 'STAFF'
          });
          setAuthState('AUTHENTICATED');
          return;
        }
        throw new Error('Invalid test credentials');
      }
      throw new Error('Microsoft Entra sign-in is not configured for the professor app.');
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
