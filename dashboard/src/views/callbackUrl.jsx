import {useState, useEffect} from 'react';
import api from '../api';
import {useMessage} from '../messageContext';
import MessageBox from '../messageBox';

const CallbackUrl = () => {

    const [callbackUrl, setCallbackUrl] = useState([]);
    const [serverStatus, setServerStatus] = useState({
        serverOnline: false,
        tokenValid: false
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
            const submitData = { url: formData.url, user: formData.user, password: formData.password}
            const response = await api.post('/callback_url/', submitData);
            if (!response.status === 200) {
                const errorData = await response.json()
                throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
            }
            setMessageInfo('success', 'LiveORC information updated successfully');

            // read back the device after posting
            fetchCallbackUrl();
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
    return (
        <div className='container'>
            Setup or change a Live connection with a LiveOpenRiverCam server to exchange videos, and receive task forms.
            <hr/>
            <MessageBox/>
            <form onSubmit={handleFormSubmit}>
                <div className='mb-3 mt-3'>
                    <label htmlFor='url' className='form-label'>
                        URL
                    </label>
                    <input type='text' className='form-control' id='url' name='url' onChange={handleInputChange} value={formData.url}/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='user' className='form-label'>
                        User name (email)
                    </label>
                    <input type='text' className='form-control' id='user' name='user' onChange={handleInputChange} value={formData.user}/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='password' className='form-label'>
                        Password
                    </label>
                    <input type='password' className='form-control' id='password' name='password' onChange={handleInputChange} value={formData.password}/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='tokenRefresh' className='form-label'>
                        Refresh token
                    </label>
                    <input type='text' className='form-control' id='tokenRefresh' name='tokenRefresh' onChange={handleInputChange} value={formData.tokenRefresh} readOnly/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='tokenAccess' className='form-label'>
                        Access token
                    </label>
                    <input type='text' className='form-control' id='tokenAccess' name='tokenAccess' onChange={handleInputChange} value={formData.tokenAccess} readOnly/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='tokenExpiration' className='form-label'>
                        Expiration time token
                    </label>
                    <input type='text' className='form-control' id='tokenExpiration' name='tokenExpiration' onChange={handleInputChange} value={formData.tokenExpiration} readOnly/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='serverStatus' className='form-label'>
                        Server status:
                    </label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        {/* Indicator for server online/offline */}
                        <div
                          style={{
                              width: '15px',
                              height: '15px',
                              borderRadius: '50%',
                              backgroundColor: serverStatus.serverOnline ? 'green' : 'red', // Green if server is online, red otherwise
                          }}
                          title={serverStatus.serverOnline ? 'online' : 'offline'}
                        ></div>
                        <span>{serverStatus.serverOnline ? 'Server is online' : 'Server is offline or your computer is not connected to the internet'}</span>

                        {/* Indicator for token validity */}
                        <div
                          style={{
                              width: '15px',
                              height: '15px',
                              borderRadius: '50%',
                              backgroundColor: serverStatus.tokenValid ? 'green' : 'red', // Green if token is valid, red otherwise
                          }}
                          title={serverStatus.tokenValid ? 'Token is valid' : 'Token is invalid or expired'}
                        ></div>
                        <span>{serverStatus.tokenValid ? 'Token is valid' : 'Token is invalid or expired'}</span>
                    </div>

                </div>

                <button type='submit' className='btn'>
                    Submit
                </button>
            </form>
        </div>

    );
};
export default CallbackUrl;