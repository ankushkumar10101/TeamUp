import axios from 'axios';

const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production, default to relative '/api' for unified single-service deployments
  if (import.meta.env.PROD) {
    return '/api';
  }
  // In development, default to local backend
  return 'http://localhost:5000/api';
};

const api = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true, // Send HTTP-only cookies
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach token from localStorage if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('teamup_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401 unauthorized & 429 rate limit exceeded
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const status = error.response.status;

      // Auto logout on 401 Unauthorized OR 429 Rate Limit Exceeded
      if (status === 401 || status === 429) {
        const isRateLimit = status === 429;
        const currentPath = window.location.pathname;

        if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
          localStorage.removeItem('teamup_token');
          localStorage.removeItem('teamup_user');
          window.dispatchEvent(new CustomEvent('teamup:logout', { detail: { reason: isRateLimit ? 'rate_limit' : 'unauthorized' } }));

          const errorMsg = isRateLimit
            ? (error.response.data?.message || 'Rate limit exceeded. You have been automatically logged out.')
            : 'Session expired. Please sign in again.';

          window.location.href = `/login?error=${encodeURIComponent(errorMsg)}`;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
