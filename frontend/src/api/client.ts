import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

const instance: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5002/api',
  withCredentials: true,
  timeout: 15000,
});

instance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers = config.headers || {} as any;
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

instance.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error) => {
    if (error?.response?.status === 401) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      } catch (err) {
        console.error('Error clearing localStorage:', err);
      }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    if (error.response) {
      console.error(
        `❌ API Error: ${error.config?.method?.toUpperCase()} ${error.config?.url}`,
        '\nStatus:', error.response.status,
        '\nMessage:', error.response.data?.message || error.message
      );
    } else if (error.request) {
      console.error('❌ Network Error — No response received:', error.request);
    } else {
      console.error('❌ Error setting up request:', error.message);
    }

    return Promise.reject(error);
  }
);

export default instance;
