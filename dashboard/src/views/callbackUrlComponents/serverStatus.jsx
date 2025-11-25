import PropTypes from "prop-types";

const ServerStatus = ({serverStatus}) => {
  return (
    <>
      <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
        {/* Indicator for server online/offline */}
        <div
          style={{
            width: '15px',
            height: '15px',
            borderRadius: '50%',
            backgroundColor: serverStatus.serverOnline === true
              ? 'green' // Green if server is online
              : serverStatus.serverOnline === false
                ? 'red' // red if server offline
                : 'grey' // server is not set
          }}
          title={serverStatus.serverOnline ? 'online' : 'offline'}
        ></div>
        <span>{serverStatus.serverOnline === true
          ? 'Server is online'
          : serverStatus.serverOnline === false
            ? 'Server is offline or your computer is not connected to the internet'
            : 'Server is not set'
        }</span>
        <div
          style={{
            width: '15px',
            height: '15px',
            borderRadius: '50%',
            backgroundColor: serverStatus.tokenValid
              ? 'green'
              : serverStatus.tokenValid === false
                ? 'red'
                : 'grey'  // no status so no token
          }}
          title={serverStatus.tokenValid ? 'valid' : 'invalid'}
        ></div>
        <span>{serverStatus.tokenValid === true
          ? 'Token is valid'
          : serverStatus.tokenValid === false
            ? 'Token is invalid or expired'
            : 'No token or server set'
        }</span>
      </div>

    </>

  )

};
ServerStatus.propTypes = {
  serverStatus: PropTypes.object,
};

export default ServerStatus;
