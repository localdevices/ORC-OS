import axios from 'axios'

// initiate without being logged in, keep token in memory
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

const api = axios.create({
   // baseURL: `http://${window.location.hostname}:5000`
   baseURL: `/api`,
   withCredentials: true
});

// intercept requests and if available, add token to header
api.interceptors.request.use((config) => {
  return config;
});

// behaviour when a 401 (not authorized) response is received
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
    }
    return Promise.reject(error);
  }

)

export default api;

let webSocketInstance = null;

export const createWebSocketConnection = (url, onMessageCallback) => {
   // Create WebSocket connection
   if (webSocketInstance) {
      console.log("WebSocket connection already exists");
      return webSocketInstance;
   }


   webSocketInstance = new WebSocket(url);

   // Event: WebSocket successfully opened
   webSocketInstance.onopen = () => {
      console.log("WebSocket connection established");
   };

   // Event: When a message is received
   webSocketInstance.onmessage = (event) => {
      console.log(JSON.parse(event.data));
      if (onMessageCallback) {
         onMessageCallback(JSON.parse(event.data)); // Execute the callback with the new message
      }
   };

   // Event: When the WebSocket connection is closed
   webSocketInstance.onclose = () => {
      console.log("WebSocket connection closed");
      webSocketInstance = null;
   };

   // Event: When an error occurs
   webSocketInstance.onerror = (error) => {
      console.error("WebSocket error:", error);
   };

   // Return the WebSocket instance
   return webSocketInstance;
};
