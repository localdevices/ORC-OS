import {useState, useEffect} from 'react';
import api from '../api';
import { DropdownMenu } from "../utils/dropdownMenu.jsx";
import MessageBox from '../messageBox';
import {useMessage} from '../messageContext';

const Settings = () => {

    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true); // State for loading indicator
    const [error, setError] = useState(null); // State for error handling
    const [videoConfigs, setVideoConfigs] = useState([]);
    const [formData, setFormData] = useState({
        video_file_fmt: '',
        allowed_dt: '',
        shutdown_after_task: false,
        parse_dates_from_file: true,
        reboot_after: '',
        video_config_id: '',
    });
    // set message box
    const {setMessageInfo} = useMessage();

    const fetchSettings = async () => {
        const response = await api.get('/settings/');
        setSettings(response.data)
    };

    useEffect(() => {
        fetchSettings();
        // also get available video configs
        const response = api.get('/video_config/');
        response.then(response => {
            setVideoConfigs(response.data);
        });

    }, []);
    useEffect(() => {
        if (settings) {
            setFormData({
                video_file_fmt: settings.video_file_fmt || '',
                allowed_dt: settings.allowed_dt || '',
                shutdown_after_task: settings.shutdown_after_task || '',
                parse_dates_from_file: settings.parse_dates_from_file || '',
                reboot_after: settings.reboot_after || '',
                video_config_id: settings.video_config_id || '',
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
    const handleInputDropdown = (event) => {
        const { name, value, type } = event.target;
        event.target.value = value;
        setFormData({
            ...formData,
            ["video_config_id"]: value
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
            // Dynamically filter only fields with non-empty values
            const filteredData = Object.fromEntries(
              Object.entries(formData).filter(([key, value]) => value !== '' && value !== null)
            );
            console.log(filteredData);
            const response = await api.post('/settings/', filteredData);
            if (!response.status === 200) {
                const errorData = await response.json()
                throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
            }
            setMessageInfo('success', 'Settings information updated successfully!');

            // read back the device after posting
            fetchSettings();
            // set the form data to new device settings
            setFormData({
                video_file_fmt: '',
                allowed_dt: '',
                shutdown_after_task: '',
                parse_dates_from_file: '',
                reboot_after: '',
                video_config_id: ''
            });
        } catch (err) {
            setMessageInfo('error', err.response.data);
        }
    };
    return (
        <div className='container'>
            <MessageBox/>
            Change your Daemon settings for automated processing of videos and water levels.
            <hr/>
            <form onSubmit={handleFormSubmit}>
                <div className='mb-3 mt-3'>
                    <label htmlFor='video_file_fmt' className='form-label'>
                        Expected video file format
                    </label>
                    <input
                      type='text'
                      className='form-control'
                      id='video_file_fmt'
                      name='video_file_fmt'
                      placeholder="{%Y%m%dT%H%M%S}.mp4"
                      onChange={handleInputChange}
                      value={formData.video_file_fmt}
                    />
                    <div className="help-block" style={{paddingLeft: "10px", fontSize: "0.6875rem", marginTop: "0", marginBottom: "0", color: "#777"}}></div>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='allowed_dt' className='form-label'>
                        Allowed time difference between video and water level time stamps
                    </label>
                    <input type='number' className='form-control' id='allowed_dt' name='allowed_dt' onChange={handleInputIntChange} value={formData.allowed_dt}/>
                </div>
                <div className='mb-3 mt-3'>
                    <input
                      type='checkbox'
                      className='form-check-input'
                      id='parse_dates_from_file'
                      name='parse_dates_from_file'
                      onChange={handleInputChange}
                      value={formData.parse_dates_from_file}
                      checked={formData.parse_dates_from_file}
                      style={{marginRight: '10px'}}
                    />
                    <label htmlFor='parse_dates_from_file' className='form-label'>
                        Parse dates from the video file name. File must have a name template such as "{"{%Y%m%dT%H%M%S.mp4}"}"
                    </label>
                </div>
                <div className='mb-3 mt-3'>
                    <input
                      type='checkbox'
                      className='form-check-input'
                      id='shutdown_after_task'
                      name='shutdown_after_task'
                      onChange={handleInputChange}
                      value={formData.shutdown_after_task}
                      checked={formData.shutdown_after_task}
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
                <div className='mb-3 mt-3'>
                  <DropdownMenu
                    dropdownLabel={"Video configurations"}
                    callbackFunc={handleInputDropdown}
                    data={videoConfigs}
                    value={formData.video_config_id}
                  />
                </div>
                <button type='submit' className='btn'>
                    Submit
                </button>

            </form>
        </div>

    );
};
export default Settings;
