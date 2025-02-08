import {useState, useEffect} from 'react';
import api from '../api';
import {useMessage} from '../messageContext';
import MessageBox from '../messageBox';

const CallbackUrl = () => {

    const [callbackUrl, setCallbackUrl] = useState([]);
    // const [user, setUser] = useState([]);
    // const [password, setPassword] = useState([]);
    // const [tokenRefresh, setTokenRefresh] = useState([]);
    // const [tokenAccess, setTokenAccess] = useState([]);
    // const [tokenExpiration, setTokenExpiration] = useState([]);
    const [loading, setLoading] = useState(true); // State for loading indicator
    const [error, setError] = useState(null); // State for error handling
    const [message, setMessage] = useState(null); // State for message handling
    const [messageType, setMessageType] = useState(null); // State for message type
    const [formData, setFormData] = useState({
        url: '',
        user: '',
        password: '',
        tokenRefresh: '',
        tokenAccess: '',
        tokenExpiration: ''
    });
    const fetchCallbackUrl = async () => {
        const response = await api.get('/callback_url/');
        setUrl(response.data)
        setUser(response.data);
        setTokenRefresh(response.data);
        setTokenAccess(response.data);
        setTokenExpiration(response.data);
    };
    const {setMessageInfo} = useMessage();

    useEffect(() => {
        fetchCallbackUrl();

    }, []);
    useEffect(() => {
        if (url) {
            setFormData({
                url: callbackUrl.url || '',
                user: callbackUrl.user || '',
                password: '',
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
            const response = await api.post('/callback_url/', formData);
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
            setMessageInfo('error', `GCPs successfully fitted, but with a large average error: ${err.response.data} m.`);
        }
    };
    return (
        <div className='container'>
            Setup a Live connection with a LiveOpenRiverCam server to exchange videos, and receive task forms.
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
                <button type='submit' className='btn'>
                    Submit
                </button>
            </form>
        </div>

    );
};
export default CallbackUrl;