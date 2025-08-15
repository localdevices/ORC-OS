import axios from 'axios'

// Ensure API_BASE_URL is defined
// if (!import.meta.env.VITE_API_BASE_URL) {
//    throw new Error('VITE_API_BASE_URL environment variable is not defined!');
// }

const api = axios.create({
   baseURL: `http://${window.location.hostname}:5000`
});

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
