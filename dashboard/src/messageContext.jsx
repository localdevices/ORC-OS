import React, { createContext, useState, useContext } from 'react';

// Create the message context
const MessageContext = createContext();

// Create a provider component
export const MessageProvider = ({ children }) => {
  const [message, setMessage] = useState(''); // Message content
  const [messageType, setMessageType] = useState(''); // 'error', 'success', 'warning'
  const [showMessage, setShowMessage] = useState(false); // Control visibility
  const [timeoutId, setTimeoutId] = useState(null);

  // Function to set a message
  const setMessageInfo = (type, content) => {
    // Clear existing time out
    if (timeoutId) {
      clearTimeout(timeoutId);
    }


    // Clear existing message first
    setShowMessage(false);
    setMessage('');
    setMessageType('');

    // Set new message
    setMessage(content);
    setMessageType(type);
    setShowMessage(true);

    // Automatically hide the message after 5 seconds
    const newTimeoutId = setTimeout(() => {
      setShowMessage(false);
    }, 5000);

    setTimeoutId(newTimeoutId);

  };

  return (
    <MessageContext.Provider value={{ message, messageType, showMessage, setMessageInfo, setShowMessage }}>
      {children}
    </MessageContext.Provider>
  );
};

// hook for context consumption
export const useMessage = () => useContext(MessageContext);
