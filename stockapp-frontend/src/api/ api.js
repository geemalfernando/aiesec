import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5001/api', // Your backend API base URL
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  (config) => {
    // Retrieve token from localStorage or wherever it's stored (e.g., AuthContext)
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;