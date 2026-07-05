import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  bio?: string | null;
  tenant_id: number;
  tenant_name: string;
  tenant_slug: string;
}

interface AuthStore {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, access: string, refresh: string) => void;
  setUser: (user: AuthUser) => void;
  clearAuth: () => void;
}

const normalizeUser = (u: AuthUser | null): AuthUser | null => {
  if (!u) return null;
  let role = u.role;
  if (role === 'sales') role = 'sale';
  if (role === 'super_admin') role = 'superadmin';
  return {
    ...u,
    role
  };
};

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);
        const normalized = normalizeUser(user);
        set({ user: normalized, accessToken, refreshToken, isAuthenticated: true });
      },
      setUser: (user) => {
        const normalized = normalizeUser(user);
        set({ user: normalized });
      },
      clearAuth: () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },
    }),
    { name: 'minth-auth', partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }) }
  )
);
