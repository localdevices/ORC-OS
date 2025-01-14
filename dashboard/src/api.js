//window.process = {};
import axios from 'axios'
//import dotenv from 'dotenv';
//dotenv.config();

// Ensure API_BASE_URL is defined
if (!import.meta.env.VITE_API_BASE_URL) {
   throw new Error('VITE_API_BASE_URL environment variable is not defined!');
}

const api = axios.create({
   baseURL: import.meta.env.VITE_API_BASE_URL, // Load from environment variable
});

//const api = axios.create({
//    baseURL: 'http://framework:8000'
//});


export default api;