import {useState, useEffect} from 'react';
import api from '../api';
import {useMessage} from '../messageContext';

const CallbackUrl = ({setRequiresRestart}) => {

  const [callbackUrl, setCallbackUrl] = useState([]);
  const [serverStatus, setServerStatus] = useState({
    serverOnline: null,
    tokenValid: null,
    error: ''
  });
  const [formData, setFormData] = useState({
    url: '',
    user: '',
    password: '',
    createdAt: '',
    tokenRefresh: '',
    tokenAccess: '',
    tokenExpiration: ''
  });
  const {setMessageInfo} = useMessage();

  const fetchCallbackUrl = async () => {
    const response = await api.get('/callback_url/');
    if (response.data != null) {
      const received_data = {
        "url": response.data.url,
        "user": '',
        "password": '',
        "createdAt": response.data.created_at,
        "tokenRefresh": response.data.token_refresh,
        "tokenAccess": response.data.token_access,
        "tokenExpiration": response.data.token_expiration
      }
      setCallbackUrl(received_data)
    }

  };
  const fetchServerStatus = async () => {
    const response = await api.get('/callback_url/health/');
    if (response.data != null) {
      setServerStatus(response.data);
    }
  }

  useEffect(() => {
    fetchCallbackUrl();
    fetchServerStatus();

  }, []);
  useEffect(() => {
    if (callbackUrl) {
      setFormData({
        url: callbackUrl.url || '',
        user: callbackUrl.user || '',
        password: '',
        createdAt: callbackUrl.createdAt,
        tokenRefresh: callbackUrl.tokenRefresh || '',
        tokenAccess: callbackUrl.tokenAccess || '',
        tokenExpiration: callbackUrl.tokenExpiration,
      });
    }
  }, [callbackUrl]);

  const handleInputChange = (event) => {
    const value = event.target.value;
    setFormData({
      ...formData,
      [event.target.name]: value,
    });
  }
  const handleFormSubmit = async (event) => {
    try {
      event.preventDefault();
      console.log(formData);
      // get only the url, user and password
      const submitData = {url: formData.url, user: formData.user, password: formData.password}
      const response = await api.post('/callback_url/', submitData);
      if (!response.status === 200) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
      }
      setMessageInfo('success', 'LiveORC information updated successfully');
      setRequiresRestart(true);

      // read back the device after posting
      fetchCallbackUrl();
      fetchServerStatus();
      // set the form data to new device settings
      setFormData({
        url: '',
        user: '',
        password: '',
        tokenRefresh: '',
        tokenAccess: '',
        tokenExpiration: ''
      });
    } catch (err) {
      console.log("ERROR: ", err);
      setMessageInfo('error', `problem updating LiveORC information. ${err.message}`);
    }
  };

  const handleDelete = async () => {
    try {
      const response = await api.delete('/callback_url/');
      if (response.status === 204) {
        setMessageInfo('success', 'LiveORC information deleted successfully');
        // Clear the fields and reload status
        setFormData({
          url: '',
          user: '',
          password: '',
          tokenRefresh: '',
          tokenAccess: '',
          tokenExpiration: ''
        });
        setServerStatus({
          serverOnline: null,
          tokenValid: null,
          error: ''
        });
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || `Delete failed. Status Code: ${response.status}`);
      }
    } catch (err) {
      console.log('ERROR: ', err);
      setMessageInfo('error', `Problem deleting LiveORC information. ${err.message}`);
    }
  };

  return (
    <div className='container'>
      Setup or change a Live connection with a LiveOpenRiverCam server to exchange videos, and receive task forms.
      <hr/>
      <form onSubmit={handleFormSubmit}>
        <div className='mb-3 mt-3'>
          <label htmlFor='url' className='form-label'>
            URL
          </label>
          <input type='text' className='form-control' id='url' name='url' onChange={handleInputChange}
                 value={formData.url}/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='user' className='form-label'>
            User name (email)
          </label>
          <input type='text' className='form-control' id='user' name='user' onChange={handleInputChange}
                 value={formData.user}/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='password' className='form-label'>
            Password
          </label>
          <input type='password' className='form-control' id='password' name='password' onChange={handleInputChange}
                 value={formData.password}/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='tokenRefresh' className='form-label'>
            Refresh token
          </label>
          <input type='text' className='form-control' id='tokenRefresh' name='tokenRefresh' onChange={handleInputChange}
                 value={formData.tokenRefresh} readOnly/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='tokenAccess' className='form-label'>
            Access token
          </label>
          <input type='text' className='form-control' id='tokenAccess' name='tokenAccess' onChange={handleInputChange}
                 value={formData.tokenAccess} readOnly/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='tokenExpiration' className='form-label'>
            Expiration time token
          </label>
          <input type='text' className='form-control' id='tokenExpiration' name='tokenExpiration'
                 onChange={handleInputChange} value={formData.tokenExpiration} readOnly/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='serverStatus' className='form-label'>
            Server status:
          </label>
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
        </div>

        <button type='submit' className='btn'>
          Submit
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={handleDelete}
        >
          Delete
        </button>

      </form>
    </div>

  );
};
export default CallbackUrl;
