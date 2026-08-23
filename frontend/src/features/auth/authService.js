import axios from 'axios';

const API_URL = 'http://localhost:5000/api/v1/auth/';

// Register user
const register = async (userData) => {
    const response = await axios.post(API_URL + 'register', userData, { withCredentials: true });
    if (response.data) {
        // Store the full response including token
        localStorage.setItem('user', JSON.stringify({
            ...response.data.user,
            token: response.data.token
        }));
    }
    return response.data;
};

// Login user
const login = async (userData) => {
    const response = await axios.post(API_URL + 'login', userData, { withCredentials: true });
    if (response.data) {
        // Store the full response including token
        localStorage.setItem('user', JSON.stringify({
            ...response.data.user,
            token: response.data.token
        }));
    }
    return response.data;
};

// Logout user — calls API to clear cookie + clears localStorage
const logout = async () => {
    try {
        await axios.get(API_URL + 'logout', { withCredentials: true });
    } catch (error) {
        console.error('Logout API call failed:', error);
    } finally {
        localStorage.removeItem('user');
    }
};

const authService = {
    register,
    logout,
    login,
};

export default authService;
