import {useState, useEffect} from 'react';
import api from '../api';
import MessageBox from '../messageBox';
import {useMessage} from '../messageContext';

const Settings = () => {

    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true); // State for loading indicator
    const [error, setError] = useState(null); // State for error handling
    const [formData, setFormData] = useState({
        video_file_format: '',
        allowed_dt: '',
        shutdown_after_task: '',
        reboot_after: '',
    });
    // set message box
    const {setMessageInfo} = useMessage();

    const fetchSettings = async () => {
        const response = await api.get('/settings/');
        setSettings(response.data)
    };

    useEffect(() => {
        fetchSettings();

    }, []);
    useEffect(() => {
        if (settings) {
            setFormData({
                video_file_format: settings.video_file_format || '',
                allowed_dt: settings.allowed_dt || '',
                shutdown_after_task: settings.shutdown_after_task || '',
                reboot_after: settings.reboot_after || '',
            });
        }
    }, [settings]);

    const handleInputChange = (event) => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        setFormData({
            ...formData,
            [event.target.name]: value,
        });
    }
    const handleInputIntChange = (event) => {
        const { name, value, type } = event.target;
        event.target.value = value;
        setFormData({
            ...formData,
            [name]: type === "number" ? parseInt(value) : value
        });
    };
    const handleFormSubmit = async (event) => {
        try {
            event.preventDefault();
            console.log(formData);
            const response = await api.post('/settings/', formData);
            if (!response.status === 200) {
                const errorData = await response.json()
                throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
            }
            setMessageInfo('success', 'Settings information updated successfully!');

            // read back the device after posting
            fetchSettings();
            // set the form data to new device settings
            setFormData({
                video_file_format: '',
                allowed_dt: '',
                shutdown_after_task: '',
                reboot_after: '',
            });
        } catch (err) {
            setMessageInfo('error', err.response.data);
        }
    };
    return (
        <div className='container'>
            <MessageBox/>
            Change your general settings.
            <hr/>
            <form onSubmit={handleFormSubmit}>
                <div className='mb-3 mt-3'>
                    <label htmlFor='video_file_format' className='form-label'>
                        Expected video file format
                    </label>
                    <input
                      type='text'
                      className='form-control'
                      id='video_file_format'
                      name='video_file_format'
                      onChange={handleInputChange}
                      value={formData.video_file_format}
                    />
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='allowed_dt' className='form-label'>
                        Allowed time difference between video and water level time stamps
                    </label>
                    <input type='text' className='form-control' id='allowed_dt' name='allowed_dt' onChange={handleInputIntChange} value={formData.allowed_dt}/>
                </div>
                <div className='mb-3 mt-3'>
                    <input
                      type='checkbox'
                      className='form-check-input'
                      id='shutdown_after_task'
                      name='shutdown_after_task'
                      onChange={handleInputChange}
                      value={formData.shutdown_after_task}
                      style={{marginRight: '10px'}}
                    />
                    <label htmlFor='shutdown_after_task' className='form-label'>
                        Shutdown the device after an automated task.
                    </label>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='reboot_after' className='form-label'>
                        Reboot device after some time [sec]. Just in case a system fails, the device may go back online after this time.
                    </label>
                    <input type='number' className='form-control' id='reboot_after' name='reboot_after' step="1" onChange={handleInputIntChange} value={formData.reboot_after}/>
                </div>
                <button type='submit' className='btn'>
                    Submit
                </button>

            </form>
        </div>

    );
};
export default Settings;