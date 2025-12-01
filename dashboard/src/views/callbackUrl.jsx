import {useState, useEffect} from 'react';
import api from '../api/api.js';
import ServerStatus from './callbackUrlComponents/serverStatus.jsx'
import {useMessage} from '../messageContext';
import {getCallbackUrl} from '../utils/apiCalls/callbackUrl.jsx'

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
    retry_timeout: 0.0,
    createdAt: '',
    tokenRefresh: '',
    tokenAccess: '',
    tokenExpiration: ''
  });
  const {setMessageInfo} = useMessage();

  const fetchCallbackUrl = async () => {
    const callbackUrlData = await getCallbackUrl();
    // const response = await api.get('/callback_url/');
    // if (response.data != null) {
    //   console.log("RESPONSE:", response.data);
    //   const received_data = {
    //     "url": response.data.url,
    //     "user": '',
    //     "password": '',
    //     "retry_timeout": response.data.retry_timeout,
    //     "remote_site_id": response.data.remote_site_id,
    //     "createdAt": response.data.created_at,
    //     "tokenRefresh": response.data.token_refresh,
    //     "tokenAccess": response.data.token_access,
    //     "tokenExpiration": response.data.token_expiration
    //   }
    setCallbackUrl(callbackUrlData)
    // }

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
      console.log(callbackUrl)
      setFormData({
        url: callbackUrl.url || '',
        user: callbackUrl.user || '',
        password: '',
        retry_timeout: callbackUrl.retry_timeout || 0.0,
        remote_site_id: callbackUrl.remote_site_id || null,
        createdAt: callbackUrl.createdAt,
        tokenRefresh: callbackUrl.tokenRefresh || '',
        tokenAccess: callbackUrl.tokenAccess || '',
        tokenExpiration: callbackUrl.tokenExpiration,
      });
    }
  }, [callbackUrl]);

  const handleInputChange = (event) => {
    const {name, value, type } = event.target;
    const parsedValue = type === "number" ? (value === "" ? "" : parseFloat(value)) : value
    setFormData({
      ...formData,
      [name]: parsedValue,
    });
  }

  const handleInputIntChange = (event) => {
    const {name, value, type} = event.target;
    event.target.value = value;
    setFormData({
      ...formData,
      [name]: type === "number" ? parseInt(value) : value
    });
  };

  const handleFormSubmit = async (event) => {
    try {
      event.preventDefault();
      // get only the url, user and password
      const submitData = {
        url: formData.url,
        user: formData.user,
        password: formData.password,
        retry_timeout: parseFloat(formData.retry_timeout),
        remote_site_id: formData.remote_site_id ? parseInt(formData.remote_site_id) : null
      }
      console.log(submitData);
      const response = await api.post('/callback_url/', submitData);
      if (!response.status === 200) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
      }
      console.log(response);
      setMessageInfo('success', response.data);
      setRequiresRestart(true);

      // read back the device after posting
      fetchCallbackUrl();
      fetchServerStatus();
      // set the form data to new device settings
      setFormData({
        url: '',
        user: '',
        retry_timeout: 0.0,
        password: '',
        remote_site_id: '',
        tokenRefresh: '',
        tokenAccess: '',
        tokenExpiration: ''
      });
    } catch (err) {
      console.log("ERROR: ", err);
      setMessageInfo('error', `problem updating LiveORC information. ${err.response.data}`);
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
          remote_site_id: '',
          retry_timeout: 0.0,
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
          <label htmlFor='remote_site_id' className='form-label'>
            Site ID (number) of the site, as known on configured LiveORC server.
          </label>
          <input type='number' className='form-control' id='remote_site_id' name='remote_site_id' step="1"
                 onChange={handleInputIntChange} value={formData.remote_site_id}/>
          <div className="help-block">
            Make sure you have access to a LiveORC server, and can write to a site. Note down the Site ID from the
            site&#39;s address bar.
          </div>

        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='password' className='form-label'>
            Time [s] to retry requests in case the device seems offline. 0 means that only one try is performed.
          </label>
          <input type='number' step='1' min='0' max='600' className='form-control' id='retry_timeout' name='retry_timeout' onChange={handleInputChange}
                 value={formData.retry_timeout}/>
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
          <ServerStatus serverStatus={serverStatus}/>
          {/*<div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>*/}
          {/*  /!* Indicator for server online/offline *!/*/}
          {/*  <div*/}
          {/*    style={{*/}
          {/*      width: '15px',*/}
          {/*      height: '15px',*/}
          {/*      borderRadius: '50%',*/}
          {/*      backgroundColor: serverStatus.serverOnline === true*/}
          {/*        ? 'green' // Green if server is online*/}
          {/*        : serverStatus.serverOnline === false*/}
          {/*          ? 'red' // red if server offline*/}
          {/*          : 'grey' // server is not set*/}
          {/*    }}*/}
          {/*    title={serverStatus.serverOnline ? 'online' : 'offline'}*/}
          {/*  ></div>*/}
          {/*    <span>{serverStatus.serverOnline === true*/}
          {/*      ? 'Server is online'*/}
          {/*      : serverStatus.serverOnline === false*/}
          {/*        ? 'Server is offline or your computer is not connected to the internet'*/}
          {/*        : 'Server is not set'*/}
          {/*    }</span>*/}
          {/*  <div*/}
          {/*    style={{*/}
          {/*      width: '15px',*/}
          {/*      height: '15px',*/}
          {/*      borderRadius: '50%',*/}
          {/*      backgroundColor: serverStatus.tokenValid*/}
          {/*        ? 'green'*/}
          {/*        : serverStatus.tokenValid === false*/}
          {/*        ? 'red'*/}
          {/*        : 'grey'  // no status so no token*/}
          {/*    }}*/}
          {/*    title={serverStatus.tokenValid ? 'valid' : 'invalid'}*/}
          {/*  ></div>*/}
          {/*  <span>{serverStatus.tokenValid === true*/}
          {/*    ? 'Token is valid'*/}
          {/*    : serverStatus.tokenValid === false*/}
          {/*    ? 'Token is invalid or expired'*/}
          {/*    : 'No token or server set'*/}
          {/*  }</span>*/}
          {/*</div>*/}
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
