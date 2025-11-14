import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authService, User } from '../lib/auth';
import { apiClient } from '../lib/apiClient';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, passwordConfirmation: string, role?: 'creator' | 'fan') => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const token = apiClient.getToken();
      if (token) {
        const response = await authService.getCurrentUser();
        if (response.ok && response.data) {
          setUser(response.data);
        } else {
          // Token invalid, clear it
          await apiClient.setToken(null);
        }
      }
    } catch (error) {
      console.error('Auth check error:', error);
      await apiClient.setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      if (response.ok && response.data) {
        setUser(response.data.user);
        return { success: true };
      } else {
        const errorMessage = response.errors?.[0]?.detail || 'Login failed';
        return { success: false, error: errorMessage };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'An error occurred' };
    }
  };

  const register = async (
    name: string,
    email: string,
    password: string,
    passwordConfirmation: string,
    role?: 'creator' | 'fan'
  ) => {
    try {
      const response = await authService.register({
        name,
        email,
        password,
        password_confirmation: passwordConfirmation,
        role,
      });
      if (response.ok && response.data) {
        setUser(response.data.user);
        return { success: true };
      } else {
        const errorMessage = response.errors?.[0]?.detail || 'Registration failed';
        return { success: false, error: errorMessage };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'An error occurred' };
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  const refreshUser = async () => {
    const response = await authService.getCurrentUser();
    if (response.ok && response.data) {
      setUser(response.data);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

