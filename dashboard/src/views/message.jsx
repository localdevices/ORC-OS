import React, { createContext, useState, useContext } from "react";

const MessageContext = createContext();


function Message({ message, messageType, clearMessage }) {
  // Auto-clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        clearMessage();
      }, 5000);
      return () => clearTimeout(timer); // Cleanup if the component unmounts
    }
  }, [message, clearMessage]);

  // If no message, render nothing
  if (!message) {
    return null;
  }

  return (
    <div
      style={{
        color: messageType === "error" ? "red" : "green",
        marginTop: "1rem",
      }}
    >
      <p>{message}</p>
    </div>
  );
}

export default Message;