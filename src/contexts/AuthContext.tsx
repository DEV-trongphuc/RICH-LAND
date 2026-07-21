import React, { createContext, useContext, useState, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';

type User = {
  id?: number;
  username: string;
  name: string;
  role: 'superadmin' | 'admin' | 'manager' | 'director' | 'assistant' | 'viewer' | 'sale';
  email?: string;
  consultant_id?: number;
  avatar?: string;
  manager_behavior_mode?: string;
  job_title?: string;
  address?: string;
  erp_profile?: any;
};

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (updatedUser: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // One-time forced relogin trigger
  if (!localStorage.getItem('richland_relogin_done_v4')) {
    localStorage.setItem('richland_relogin_done_v4', 'true');
    localStorage.removeItem('richland_token');
    localStorage.removeItem('richland_user');
  }

  const normalizeUser = (u: any): User | null => {
    if (!u) return null;
    let role = u.role;
    if (role === 'sales') role = 'sale';
    if (role === 'super_admin') role = 'superadmin';
    return {
      ...u,
      name: u.full_name || u.name || u.username || '',
      avatar: u.avatar || u.avatar_url || '',
      role
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

  const updateUser = useCallback((updatedUser: Partial<User>) => {
    setUser(prev => {
      if (!prev) return null;
      const merged = { ...prev, ...updatedUser };
      const normalized = normalizeUser(merged);
      if (normalized) {
        localStorage.setItem('richland_user', JSON.stringify(normalized));
      }
      return normalized;
    });
  }, []);

  React.useEffect(() => {
    if (user?.id) {
      const fetchLatestProfile = async () => {
        try {
          const res = await api.get(`/users/${user.id}`);
          if (res.data) {
            const data = res.data.data || res.data;
            const latestAvatar = data.avatar_url || data.avatar;
            const latestName = data.full_name || data.name;
            if ((latestAvatar && latestAvatar !== user.avatar) || (latestName && latestName !== user.name)) {
              updateUser({ avatar: latestAvatar, name: latestName });
            }
          }
        } catch (err) {
          console.error("Failed to sync user profile on mount:", err);
        }
      };
      fetchLatestProfile();
    }
  }, [user?.id, updateUser]);

  React.useEffect(() => {
    if (user) {
      useAuthStore.getState().setUser(user as any);
      if (token) {
        useAuthStore.setState({ accessToken: token, isAuthenticated: true });
      }
    } else {
      useAuthStore.getState().clearAuth();
    }
  }, [user, token]);

  const contextValue = React.useMemo(() => ({ user, token, login, logout, updateUser }), [user, token, login, logout, updateUser]);

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
