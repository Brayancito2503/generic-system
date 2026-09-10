import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { ApiError } from '@/types/api';
import storage from '@/utils/auth-storage';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request Interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = storage.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response Interceptor
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error: AxiosError<ApiError>) => {
    const message = error.response?.data?.message || error.message || 'Unknown Error';
    const code = error.response?.data?.code;
    const status = error.response?.status;

    console.error(`[API Error] ${code ? `(${code})` : ''} ${message}`);

    // Handle 401 Unauthorized
    if (status === 401) {
      storage.clearToken();
      // Optional: Trigger a custom event or redirect if not handled by AuthProvider
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    const apiError: ApiError = {
      type: 'API_ERROR',
      message,
      code,
      status,
      details: error.response?.data?.details,
    };

    // Manejo de 403 (Prohibido)
    if (status === 403) {
      console.error('No tienes permisos para realizar esta acción');
    }

    // Manejo de 500 (Error del Servidor)
    if (status && status >= 500) {
      console.error('Error crítico en el backend (.NET)');
    }
    return Promise.reject(apiError);
  }
);


export const getLargeData = (signal?: AbortSignal) => {
  return apiClient.get('/pedidos/reporte-largo', { signal });
};