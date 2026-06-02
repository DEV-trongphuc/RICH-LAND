import React, { createContext, useContext, useState, useCallback } from 'react';

type User = {
  username: string;
  name: string;
  role: 'superadmin' | 'admin' | 'assistant' | 'viewer' | 'sale';
  email?: string;
  consultant_id?: number;
  avatar?: string;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // One-time forced relogin trigger
  if (!localStorage.getItem('domation_relogin_done')) {
    localStorage.setItem('domation_relogin_done', 'true');
    localStorage.removeItem('domation_token');
    localStorage.removeItem('domation_user');
  }

  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('domation_user');
    return storedUser ? JSON.parse(storedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('domation_token');
  });

  const login = useCallback((newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('domation_token', newToken);
    localStorage.setItem('domation_user', JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('domation_token');
    localStorage.removeItem('domation_user');
    localStorage.removeItem('DOMATION_DEMO_MODE');
  }, []);

  const contextValue = React.useMemo(() => ({ user, token, login, logout }), [user, token, login, logout]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
