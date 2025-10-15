import axios from 'axios'

const API_BASE = import.meta.env.VITE_ORC_API_BASE ?? '/api';
const API_DIRECT = import.meta.env.VITE_ORC_API_DIRECT ?? '/api';  // only in dev mode

const api = axios.create({
   baseURL: API_BASE,
   // baseURL: `http://localhost:5000`,
   withCredentials: true
});

// intercept requests and modify end point if it concerns a file upload, only used in dev mode
api.interceptors.request.use((config) => {
  if (config.method === "post" && config.headers["Content-Type"] === "multipart/form-data") {
    config.baseURL = API_DIRECT; // bypass proxy for uploads during development, this allows for larger file requests
  }
  if (config.method === "get" && config.url.includes("/play/")) {
    config.baseURL = API_DIRECT;
  }
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

let webSocketInstances = {};

export const createWebSocketConnection = (connectionId, url, onMessageCallback, json) => {
   // Create WebSocket connection
  if (json === undefined) {
    json = true;
  }
   if (webSocketInstances[connectionId]) {
     // uncomment below to debug
     //  console.log(`WebSocket connection with ID "${connectionId}" already exists`);
      return webSocketInstances[connectionId];
   }
   const webSocket = new WebSocket(url);

   // Event: WebSocket successfully opened
   webSocket.onopen = () => {
     // uncomment below to debug
     // console.log("WebSocket connection established");
   };

   // Event: When a message is received
   webSocket.onmessage = (event) => {
     let msg;
     if (json === true) {
       msg = JSON.parse(event.data)
     } else {
       msg = event.data
     }
     // uncomment below to debug
      // console.log(`Message on connection Id "${connectionId}":`, msg);
      if (onMessageCallback) {
         onMessageCallback(msg); // Execute the callback with the new message
      }
   };

   // Event: When the WebSocket connection is closed
   webSocket.onclose = () => {
      // uncomment below to debug
      // console.log(`WebSocket connection with ID ${connectionId} closed`);
      delete webSocketInstances[connectionId];
   };

   // Event: When an error occurs
   webSocket.onerror = (error) => {
      console.error(`WebSocket error on connection ID "${connectionId}":`, error);
   };

   // store and return webSocket instance
  webSocketInstances[connectionId] = webSocket;
   return webSocket;
};
