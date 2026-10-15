import React, { createContext, useContext, useState, useEffect } from 'react';
import { setAuthToken } from '../services/api/client';
import { authService } from '../services/api/authService';
import { Student } from '@smart-attendance/shared';

type AuthState = 'UNAUTHENTICATED' | 'AUTHENTICATING' | 'AUTHENTICATED';

interface AuthContextData {
  authState: AuthState;
  user: Student | null;
  login: (username: string, registerNumber: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>('UNAUTHENTICATED');
  const [user, setUser] = useState<Student | null>(null);

  useEffect(() => {
    // In future phases: load from SecureStore
    // For now, always start unauthenticated
  }, []);

  const login = async (username: string, registerNumber: string) => {
    setAuthState('AUTHENTICATING');
    try {
      if (!username || !registerNumber || username !== registerNumber) {
        throw new Error('Username and Register Number must match.');
      }
      
      const { student } = await authService.studentLogin(username, registerNumber);
      
      if (student) {
        setAuthToken(student.registerNumber); // In this phase we use the register number as a simple token
        setUser(student);
        setAuthState('AUTHENTICATED');
      } else {
        throw new Error('Login failed.');
      }
    } catch (e) {
      setAuthState('UNAUTHENTICATED');
      throw e;
    }
  };

  const logout = async () => {
    setUser(null);
    setAuthToken(null);
    setAuthState('UNAUTHENTICATED');
  };

  return (
    <AuthContext.Provider value={{ authState, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
