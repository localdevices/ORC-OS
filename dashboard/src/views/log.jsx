import { useState, useEffect, useRef } from 'react';
import api, {createWebSocketConnection} from '../api/api.js';
import {getLogLineStyle} from "../utils/helpers.jsx";

const Log = () => {
  const [logData, setLogData] = useState(""); // Stores video metadata
  const logContainerRef = useRef(null); // Ref for the log container div

  // WebSocket message callback to append new log lines
  const handleWebSocketMessage = (newLine) => {
    setLogData((prevLogData) => [...prevLogData, newLine]); // Append the new message to the existing log data
  };
  // Fetch video metadata from API
  useEffect(() => {
    api.get('/log/') // Retrieve list from api
      .then((response) => {
        const lines = response.data.split("\n");
        setLogData(lines);
        // Calculate the index range for records to display
      })
      .catch((error) => {
        console.error('Error fetching log data:', error);
      });
    const timeout = setTimeout(() => {
      const ws = createWebSocketConnection(
        "log",
        `ws://${window.location.hostname}:5000/api/log/stream/`,
        handleWebSocketMessage,
        false
      );
      // Cleanup when component unmounts
      return () => {
        if (ws) {
          ws.close();
        }
      };
    }, 100);
    return () => clearTimeout(timeout);

  }, []);

  // Automatically scroll to the bottom of the log container when new lines are added
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logData]);

  return (
    <div>
      <h1>ORC Log file </h1>
      Investigate the log file to see and debug any issues.
      <div className="flex-container column" style={{
        margin: "0px",
        marginTop: "20px",
        marginBottom: "20px",
        height: "calc(100vh - 250px)",
        minHeight: "500px"
      }}>
        <div
          className="log-container"
          ref={logContainerRef} // Attach the ref to the container
        >
          {logData.length > 0 ? (
            logData.map((line, index) => (
              <div key={index} style={getLogLineStyle(line)}>
                {line}
              </div>
            ))
          ) : (
            <div>Loading logs...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Log;
