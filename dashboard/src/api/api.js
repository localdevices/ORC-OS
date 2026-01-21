import axios from 'axios'
import { useEffect, useRef} from "react";
import {createDebounce} from "../utils/helpers.jsx";

const API_BASE = import.meta.env.VITE_ORC_API_BASE ?? '/api';
const API_DIRECT = import.meta.env.VITE_ORC_API_DIRECT ?? '/api';  // only in dev mode

const api = axios.create({
   baseURL: API_BASE,
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
  const socketProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socketUrl = `${socketProtocol}//${window.location.host}${API_BASE}${url}`;
  let reconnectTimeout;

  const connect = () => {
    const webSocket = new WebSocket(socketUrl);
    webSocketInstances[connectionId] = webSocket;

    // add a method to send json messages
    webSocket.sendJson = async (msg) => {
      if (webSocket.readyState !== WebSocket.OPEN) throw new Error(
        `WebSocket is not open (readyState = ${webSocket.readyState})`
      );
      try {
        webSocket.send(json ? JSON.stringify(msg) : msg);
      } catch (e) {
        console.error("WebSocket payload or sending error:", e);
      }
    }
    // Event: WebSocket successfully opened
    webSocket.onopen = () => {
      // uncomment below to debug
      console.log("WebSocket connection established");
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };

    // Event: When a message is received
    webSocket.onmessage = (event) => {
      let msg;
      try {
        msg = json ? JSON.parse(event.data) : event.data;
        // uncomment below to debug
        // console.log(`Message on connection Id "${connectionId}":`, msg);
        if (onMessageCallback) onMessageCallback(msg, webSocket);
      } catch (e) {
        console.error("WS parsing error:", e);
      }
    };

    // Event: When the WebSocket connection is closed
    webSocket.onclose = (e) => {
      // uncomment below to debug
      console.log(`WebSocket ${connectionId} closed. Reconnecting in 3s...`, e.reason);
      delete webSocketInstances[connectionId];
      // Avoid reconnecting if the close was intentional (status code 1000)
      if (e.code !== 1000) {
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    // Event: When an error occurs
    webSocket.onerror = (error) => {
      console.error(`WebSocket error on connection ID "${connectionId}":`, error);
      webSocket.close();
    };

    return webSocket;
  };
  return connect()
};

// gracefully close a connection from list of connection
export const closeWebSocketConnection = (connectionId, code = 1000, reason = 'Intentional close') => {
  const ws = webSocketInstances[connectionId];
  if (!ws) {
    return;
  }

  // Prevent the onclose handler from attempting to reconnect
  ws.onclose = null;

  try {
    ws.close(code, reason);
  } catch (e) {
    console.error(`Error while closing WebSocket "${connectionId}":`, e);
  }
  delete webSocketInstances[connectionId];
};

// a debounced message sender for web sockets

// Generic debounced WebSocket sender
export const useDebouncedWsSender = (ws, delayMs = 400) => {
  const sendRef = useRef(null);

  useEffect(() => {
    if (!ws) {
      sendRef.current = null;
      return undefined;
    }

    const debounced = createDebounce((msg) => {
      ws.sendJson(msg);
    }, delayMs);

    sendRef.current = debounced;

    return () => {
      debounced.cancel && debounced.cancel();
      sendRef.current = null;
    };
  }, [ws, delayMs]);

  // Stable function to call from event handlers
  return (msg) => {
    if (sendRef.current) {
      sendRef.current(msg);
    }
  };
};
