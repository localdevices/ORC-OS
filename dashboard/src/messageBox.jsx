import { FaTimes } from 'react-icons/fa';
import { useMessage } from './messageContext'; // Adjust the path

const MessageBox = () => {
  const { message, messageType, showMessage, setShowMessage } = useMessage();

  if (!showMessage || !message) return null; // Don't show the box if there's no message

  const getBackgroundColor = () => {
    switch (messageType) {
      case 'success':
        return '#dff0d8'; // Light green
      case 'error':
        return '#f2dede'; // Light red
      case 'warning':
        return '#fcf8e3'; // Light yellow
      default:
        return '#f5f5f5'; // Default (grayish)
    }
  };

  const getTextColor = () => {
    switch (messageType) {
      case 'success':
        return '#3c763d'; // Dark green
      case 'error':
        return '#a94442'; // Dark red
      case 'warning':
        return '#8a6d3b'; // Dark yellow
      default:
        return '#333'; // Default dark gray
    }
  };

  return (
    <div
      style={{

        position: 'fixed', // Position absolutely within a parent container (e.g., Navbar)
        top: '40px', // Center the message box vertically
        right: '10px',
        // left: 'max(30px, 50%)',
        // transform: 'translate(-110%, 0%)', // Adjust for width/height shift due to centering
        zIndex: '999999', // Ensure it appears on top of other elements
        width: '1400px', // Fixed maximum width
        maxWidth: 'calc(100vw - 140px)',
        backgroundColor: getBackgroundColor(),
        color: getTextColor(),
        padding: '7px',
        borderRadius: '5px',
        borderWidth: '1px',
        borderColor: 'black',
        textAlign: 'center',

      }}
    >
      <FaTimes
        onClick={() => setShowMessage(false)} // Hide the message on clicking
        style={{
          position: 'absolute',
          zIndex: 999999,
          right: '10px',
          top: '10px',
          cursor: 'pointer',
        }}
      />

      {message}
    </div>
  );
};

export default MessageBox;
