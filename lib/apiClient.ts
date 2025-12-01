import axios, { AxiosError, AxiosInstance } from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

const TOKEN_KEY = 'phanrise_auth_token';

// Get API base URL from environment or use default
// Expo reads env vars from Constants.expoConfig.extra (from app.config.js) or process.env
const getApiBaseUrl = () => {
  const url = 
    Constants.expoConfig?.extra?.apiBaseUrl || 
    process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/+$/, '') || 
    'http://localhost:8000/api';
  
  // Debug: Log the API URL being used
  console.log('🔗 API Base URL:', url);
  console.log('📱 Constants.expoConfig?.extra:', Constants.expoConfig?.extra);
  console.log('🌐 process.env.EXPO_PUBLIC_API_BASE_URL:', process.env.EXPO_PUBLIC_API_BASE_URL);
  
  return url;
};

const API_BASE_URL = getApiBaseUrl();
const IDEMPOTENT_METHODS = ['post', 'put', 'patch', 'delete'];

const generateIdempotencyKey = (): string => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `idemp-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

export type ApiError = {
  title?: string;
  detail?: string;
  code?: string;
  source?: Record<string, unknown>;
};

export type ApiResponse<T> = {
  ok: boolean;
  status: number;
  data?: T;
  errors?: ApiError[];
  meta?: Record<string, unknown>;
  raw?: unknown;
};

class ApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000, // 10 second timeout
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      maxRedirects: 0, // Don't follow redirects - API should return JSON, not redirects
      validateStatus: (status) => status < 500, // Don't throw on 4xx errors, handle them ourselves
    });

    // Load token from secure storage (async, but we'll handle it)
    this.loadToken().catch(console.error);

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      async (config) => {
        config.headers = config.headers ?? {};
        const method = (config.method ?? 'get').toLowerCase();
        
        // Log every request for debugging
        console.log(`🔵 Axios Request: ${method.toUpperCase()} ${config.url}`, {
          hasData: !!config.data,
          hasAuth: !!config.headers?.Authorization,
        });

        if (this.token && !config.headers.Authorization) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }

        if (IDEMPOTENT_METHODS.includes(method) && !config.headers['Idempotency-Key']) {
          config.headers['Idempotency-Key'] = generateIdempotencyKey();
        }

        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        if (error.response?.status === 401) {
          // Token expired or invalid, clear it
          await this.setToken(null);
        }
        return Promise.reject(error);
      }
    );
  }

  async setToken(token: string | null) {
    this.token = token;
    if (token) {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
    } else {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
    }
  }

  async loadToken(): Promise<void> {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      this.token = token;
    } catch (error) {
      console.error('Error loading token:', error);
      this.token = null;
    }
  }

  getToken(): string | null {
    return this.token;
  }

  async request<T>(
    path: string,
    options: {
      method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
      data?: unknown;
      skipAuth?: boolean;
    } = {}
  ): Promise<ApiResponse<T>> {
    const method = options.method || 'GET';
    const url = path.startsWith('/') ? path : `/${path}`;
    
    // Debug logging
    console.log(`📤 API Request: ${method} ${url}`, options.data ? { hasData: true } : {});
    
    try {
      const response = await this.client.request({
        url,
        method,
        data: options.data,
        headers: options.skipAuth ? { Authorization: '' } : undefined,
      });

      return {
        ok: true,
        status: response.status,
        data: response.data?.data,
        errors: response.data?.errors,
        meta: response.data?.meta,
        raw: response.data,
      };
    } catch (error) {
      console.error('API Request Error:', error);
      console.error('Request URL:', `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`);
      
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        console.error('Axios Error Details:', {
          message: axiosError.message,
          code: axiosError.code,
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
        });
        
        // Network error (no response)
        if (!axiosError.response) {
          return {
            ok: false,
            status: 0,
            errors: [
              {
                title: 'Network Error',
                detail: axiosError.message || 'Unable to connect to server. Please check your internet connection and ensure the backend is running.',
              },
            ],
          };
        }
        
        return {
          ok: false,
          status: axiosError.response?.status || 500,
          data: (axiosError.response?.data as any)?.data,
          errors: (axiosError.response?.data as any)?.errors || [
            {
              title: 'Request failed',
              detail: axiosError.message || 'An error occurred',
            },
          ],
          meta: (axiosError.response?.data as any)?.meta,
          raw: axiosError.response?.data,
        };
      }

      return {
        ok: false,
        status: 500,
        errors: [
          {
            title: 'Unknown error',
            detail: error instanceof Error ? error.message : 'An unexpected error occurred',
          },
        ],
      };
    }
  }

  // Convenience methods
  async get<T>(path: string, skipAuth?: boolean): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'GET', skipAuth });
  }

  async post<T>(path: string, data?: unknown, skipAuth?: boolean): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'POST', data, skipAuth });
  }

  async put<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'PUT', data });
  }

  async patch<T>(path: string, data?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'PATCH', data });
  }

  async delete<T>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

