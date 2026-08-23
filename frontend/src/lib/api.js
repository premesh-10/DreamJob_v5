import axios from 'axios';

const API_BASE_URL = 'https://dreamjob-v5.onrender.com/api/v1';

const api = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
});

// Attach token from localStorage if available (for Authorization header fallback)
api.interceptors.request.use((config) => {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (user && user.token) {
        config.headers['Authorization'] = `Bearer ${user.token}`;
    }
    return config;
});

// Handle 401 / 403 globally
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;
        const msg = error.response?.data?.message || '';

        if (status === 401) {
            // Token expired — clear localStorage
            localStorage.removeItem('user');
        }

        if (status === 403 && msg.toLowerCase().includes('suspended')) {
            // Account blocked — force logout and redirect to login with a flag
            localStorage.removeItem('user');
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
                window.location.href = '/login?blocked=1';
            }
        }

        if (status === 503 && error.response?.data?.maintenance) {
            // Platform is in maintenance mode — store message and redirect
            const maintenanceMsg = error.response.data.message || '';
            if (maintenanceMsg) sessionStorage.setItem('maintenanceMessage', maintenanceMsg);
            if (typeof window !== 'undefined' && !window.location.pathname.includes('/maintenance')) {
                window.location.href = '/maintenance';
            }
        }

        return Promise.reject(error);
    }
);

export default api;
