'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SafeUser } from '@splitwise/types';
import { apiFetch, ApiClientError } from './api';
import { LoginInput, RegisterInput } from '@splitwise/validation';

interface AuthContextType {
  user: SafeUser | null;
  isLoading: boolean;
  login: (data: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      const userData = await apiFetch<SafeUser>('/api/auth/me');
      setUser(userData);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (data: LoginInput) => {
    const res = await apiFetch<{ user: SafeUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setUser(res.user);
    router.push('/dashboard');
  };

  const register = async (data: RegisterInput) => {
    const res = await apiFetch<{ user: SafeUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    setUser(res.user);
    router.push('/dashboard');
  };

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
