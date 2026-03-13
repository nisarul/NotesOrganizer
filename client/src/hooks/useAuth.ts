import { useEffect } from 'react';
import { create } from 'zustand';
import { api, setTokens, clearTokens, getAccessToken } from '../lib/api';

interface User {
  id: string;
  username: string;
  email: string;
}

interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  _initialized: boolean;
  _init: () => Promise<void>;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, email: string, password: string) => Promise<User>;
  logout: () => void;
}

const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  _initialized: false,

  _init: async () => {
    if (get()._initialized) return;
    set({ _initialized: true });

    const token = getAccessToken();
    if (!token) {
      set({ user: null, isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const data = await api<{ user: User }>('/auth/me');
      set({ user: data.user, isLoading: false, isAuthenticated: true });
    } catch {
      clearTokens();
      set({ user: null, isLoading: false, isAuthenticated: false });
    }
  },

  login: async (username: string, password: string) => {
    const data = await api<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }), skipAuth: true }
    );
    setTokens(data.accessToken, data.refreshToken);
    set({ user: data.user, isLoading: false, isAuthenticated: true });
    return data.user;
  },

  register: async (username: string, email: string, password: string) => {
    const data = await api<{ user: User; accessToken: string; refreshToken: string }>(
      '/auth/register',
      { method: 'POST', body: JSON.stringify({ username, email, password }), skipAuth: true }
    );
    setTokens(data.accessToken, data.refreshToken);
    set({ user: data.user, isLoading: false, isAuthenticated: true });
    return data.user;
  },

  logout: () => {
    clearTokens();
    set({ user: null, isLoading: false, isAuthenticated: false });
  },
}));

export function useAuth() {
  const store = useAuthStore();

  useEffect(() => {
    store._init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    user: store.user,
    isLoading: store.isLoading,
    isAuthenticated: store.isAuthenticated,
    login: store.login,
    register: store.register,
    logout: store.logout,
  };
}
