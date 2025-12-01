import { apiClient } from './apiClient';

export type User = {
  id: number;
  name: string;
  username?: string;
  display_name?: string | null;
  avatar_url?: string | null;
  email: string;
  email_verified_at: string | null;
  role: 'admin' | 'creator' | 'fan';
  default_coin_symbol?: string | null;
  verified_creator?: boolean;
  created_at: string;
  updated_at: string;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterData = {
  name: string;
  email: string;
  password: string;
  password_confirmation: string;
  role?: 'creator' | 'fan';
};

export type AuthResponse = {
  token: string;
  user: User;
};

export const authService = {
  async login(credentials: LoginCredentials) {
    console.log('🔐 Login attempt - calling POST /v1/auth/login');
    const response = await apiClient.post<AuthResponse>(
      '/v1/auth/login',
      credentials,
      true // skipAuth for login
    );
    console.log('🔐 Login response:', { ok: response.ok, status: response.status });

    if (response.ok && response.data?.token) {
      await apiClient.setToken(response.data.token);
      return response;
    }

    return response;
  },

  async register(data: RegisterData) {
    const response = await apiClient.post<AuthResponse>(
      '/v1/auth/register',
      data,
      true // skipAuth for register
    );

    if (response.ok && response.data?.token) {
      await apiClient.setToken(response.data.token);
      return response;
    }

    return response;
  },

  async logout() {
    try {
      await apiClient.post('/v1/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await apiClient.setToken(null);
    }
  },

  async getCurrentUser() {
    return apiClient.get<User>('/v1/auth/me');
  },
};

