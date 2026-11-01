import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:5001/api', // Your backend API base URL
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;