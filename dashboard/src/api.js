import axios from 'axios'

const api = axios.create({
    baseURL: 'http://framework:8000'
});


export default api;