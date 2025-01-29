import React, { createContext, useState, useContext } from 'react';

// Create the context
const MessageContext = createContext();

// Create a provider component
export const MessageProvider = ({ children }) => {
  const [message, setMessage] = useState(''); // Message content
  const [messageType, setMessageType] = useState(''); // 'error', 'success', 'warning'
  const [showMessage, setShowMessage] = useState(false); // New state to control visibility


  // Function to set a message
  const setMessageInfo = (type, content) => {
    setMessage(content);
    setMessageType(type);
    setShowMessage(true);

    // Optional: Clear the message automatically after a timeout
    setTimeout(() => {
      setShowMessage(false);
      setMessage('');
      setMessageType('');
    }, 5000); // 5 seconds
  };

  return (
    <MessageContext.Provider value={{ message, messageType, showMessage, setMessageInfo, setShowMessage }}>
      {children}
    </MessageContext.Provider>
  );
};

// Create a hook to consume the context easily
export const useMessage = () => useContext(MessageContext);
