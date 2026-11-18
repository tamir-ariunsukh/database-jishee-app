'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api } from './api';
import type { Cart, User } from './types';

const STORAGE_KEY = 'delivery_auth';

interface StoredAuth {
  token: string;
  user: User;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: {
    email: string;
    password: string;
    full_name: string;
    phone?: string;
    role?: 'customer' | 'driver';
  }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStorage(): StoredAuth | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = readStorage();
    if (!stored) {
      setLoading(false);
      return;
    }
    setToken(stored.token);
    setUser(stored.user);
    api<{ data: User }>('/auth/me', { token: stored.token })
      .then((res) => {
        setUser(res.data);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: stored.token, user: res.data }));
      })
      .catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const persist = useCallback((nextToken: string, nextUser: User) => {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api<{ data: { token: string; user: User } }>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      persist(res.data.token, res.data.user);
      return res.data.user;
    },
    [persist],
  );

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      full_name: string;
      phone?: string;
      role?: 'customer' | 'driver';
    }) => {
      const res = await api<{ data: { token: string; user: User } }>('/auth/register', {
        method: 'POST',
        body: input,
      });
      persist(res.data.token, res.data.user);
      return res.data.user;
    },
    [persist],
  );

  const logout = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!token) return;
    const res = await api<{ data: User }>('/auth/me', { token });
    setUser(res.data);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, user: res.data }));
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      login,
      register,
      logout,
      refreshUser,
      isAdmin: user?.role === 'admin',
    }),
    [user, token, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}

interface CartContextValue {
  cart: Cart | null;
  loading: boolean;
  count: number;
  refresh: () => Promise<Cart | null>;
  addItem: (input: {
    productId: string;
    quantity: number;
    optionIds?: string[];
    specialInstructions?: string | null;
  }) => Promise<void>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clear: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) {
      setCart(null);
      return null;
    }
    setLoading(true);
    try {
      const res = await api<{ data: Cart }>('/cart', { token });
      setCart(res.data);
      return res.data;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      setCart(null);
      return;
    }
    void refresh();
  }, [token, refresh]);

  const addItem = useCallback<CartContextValue['addItem']>(
    async ({ productId, quantity, optionIds, specialInstructions }) => {
      if (!token) throw new Error('Нэвтэрч орно уу');
      const res = await api<{ data: Cart }>('/cart/items', {
        method: 'POST',
        token,
        body: {
          product_id: productId,
          quantity,
          option_ids: optionIds ?? [],
          special_instructions: specialInstructions ?? null,
        },
      });
      setCart(res.data);
    },
    [token],
  );

  const setQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (!token) return;
      const res = await api<{ data: Cart }>(`/cart/items/${itemId}`, {
        method: 'PATCH',
        token,
        body: { quantity },
      });
      setCart(res.data);
    },
    [token],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      if (!token) return;
      const res = await api<{ data: Cart }>(`/cart/items/${itemId}`, {
        method: 'DELETE',
        token,
      });
      setCart(res.data);
    },
    [token],
  );

  const clear = useCallback(async () => {
    if (!token) return;
    const res = await api<{ data: Cart }>('/cart', { method: 'DELETE', token });
    setCart(res.data);
  }, [token]);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      count: cart?.item_count ?? 0,
      refresh,
      addItem,
      setQuantity,
      removeItem,
      clear,
    }),
    [cart, loading, refresh, addItem, setQuantity, removeItem, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used inside <CartProvider>');
  return context;
}
