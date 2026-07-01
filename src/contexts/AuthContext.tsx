import React, { createContext, useContext, useState, useCallback } from 'react';

type User = {
  id?: number;
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
  if (!localStorage.getItem('richland_relogin_done')) {
    localStorage.setItem('richland_relogin_done', 'true');
    localStorage.removeItem('richland_token');
    localStorage.removeItem('richland_user');
  }

  const normalizeUser = (u: any): User | null => {
    if (!u) return null;
    return {
      ...u,
      role: u.role === 'sales' ? 'sale' : u.role
    };
  };

  const [user, setUser] = useState<User | null>(() => {
    const storedUser = localStorage.getItem('richland_user');
    return storedUser ? normalizeUser(JSON.parse(storedUser)) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('richland_token');
  });

  const login = useCallback((newToken: string, newUser: User) => {
    const normalized = normalizeUser(newUser);
    setToken(newToken);
    setUser(normalized);
    localStorage.setItem('richland_token', newToken);
    localStorage.setItem('richland_user', JSON.stringify(normalized));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('richland_token');
    localStorage.removeItem('richland_user');
    localStorage.removeItem('RICH LAND_DEMO_MODE');
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
