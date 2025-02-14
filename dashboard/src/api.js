import axios from 'axios'

// Ensure API_BASE_URL is defined
// if (!import.meta.env.VITE_API_BASE_URL) {
//    throw new Error('VITE_API_BASE_URL environment variable is not defined!');
// }

const api = axios.create({
   baseURL: `http://${window.location.hostname}:8000`
});

export default api;