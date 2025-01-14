import React, {useState, useEffect} from 'react';
import api from '../api';


const DiskManagement = () => {

    const [device, updateDevice] = useState([]);
    const [deviceStatuses, setDeviceStatuses] = useState([]);
    const [deviceStatus, setDeviceStatus] = useState(''); // State for the selected status
    const [deviceFormStatus, setDeviceFormStatus] = useState(''); // State for the selected status
    const [deviceFormStatuses, setDeviceFormStatuses] = useState([]);
    const [loading, setLoading] = useState(true); // State for loading indicator
    const [error, setError] = useState(null); // State for error handling
    const [formData, setFormData] = useState({
        name: '',
        operating_system: '',
        processor: '',
        memory: '',
        status: '',
        form_status: '',
        nodeorc_version: '',
        message: ''
    });
    const fetchDevice = async () => {
        const response = await api.get('/device/');
        updateDevice(response.data)
        setDeviceStatus(response.data.status);
        setDeviceFormStatus(response.data.form_status);
    };
    const fetchDeviceStatuses = async () => {
        try {
            const response = await api.get('/device/statuses/');
            setDeviceStatuses(response.data); // Assuming API returns array of statuses
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch device statuses.');
            setLoading(false);
        }
    };
    const fetchDeviceFormStatuses = async () => {
        try {
            const response = await api.get('/device/form_statuses/');
            setDeviceFormStatuses(response.data); // Assuming API returns array of statuses
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch device form statuses.');
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDevice();
        fetchDeviceStatuses();
        fetchDeviceFormStatuses();

    }, []);
    useEffect(() => {
        if (device) {
            setFormData({
                name: device.name || '',
                operating_system: device.operating_system || '',
                processor: device.processor || '',
                memory: device.memory || '',
                status: device.status,
                form_status: device.form_status || '',
                nodeorc_version: device.nodeorc_version || '',
                message: device.message || '',
            });
        }
    }, [device]);

    const handleInputChange = (event) => {
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        setFormData({
            ...formData,
            [event.target.name]: value,
        });
    }
    const handleInputIntChange = (event) => {
        console.log(event.target);
        const { name, value, type } = event.target;
        event.target.value = value;
        setFormData({
            ...formData,
            [name]: type === "number" | type === "select-one" ? parseInt(value) : value
        });
    };
    const handleStatusChange = (e) => {
        setDeviceStatus(e.target.value); // Update selected status in state
        handleInputIntChange(e); // Pass the change event to the parent handler
    };
    const handleFormStatusChange = (e) => {
        setDeviceFormStatus(e.target.value); // Update selected status in state
        handleInputIntChange(e); // Pass the change event to the parent handler
    };
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        await api.post('/device/', formData);
        // read back the device after posting
        fetchDevice();
        // set the form data to new device settings
        setFormData({
            name: '',
            operating_system: '',
            processor: '',
            memory: '',
            status: '',
            form_status: '',
            nodeorc_version: '',
            message: ''
        });
        setDeviceStatus(device.status);

    };
    return (
        <div className='container'>
            Change your device details. You can only change a few fields. Most are set and controlled by NodeORC.
            <hr/>
            <form onSubmit={handleFormSubmit}>
                <div className='mb-3 mt-3'>
                    <label htmlFor='name' className='form-label'>
                        Name
                    </label>
                    <input type='text' className='form-control' id='name' name='name' onChange={handleInputChange} value={formData.name}/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='operating_system' className='form-label'>
                        Operating system
                    </label>
                    <input type='text' className='form-control' id='operating_system' name='operating_system' onChange={handleInputChange} value={formData.operating_system} readOnly />
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='processor' className='form-label'>
                        Processor
                    </label>
                    <input type='text' className='form-control' id='processor' name='processor' onChange={handleInputChange} value={formData.processor} readOnly/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='memory' className='form-label'>
                        Memory
                    </label>
                    <input type='number' className='form-control' id='memory' name='memory' step="0.01" onChange={handleInputChange} value={formData.memory} readOnly/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='status' className='form-label'>
                        Status
                    </label>
                    {loading ? (
                        <div>Loading...</div> // Show loading indicator
                    ) : error ? (
                        <div className="text-danger">{error}</div> // Show error message
                    ) : (
                    <select name="status" id="status" className="form-select" onChange={handleStatusChange} value={deviceStatus} disabled>
                        {deviceStatuses.map((status) => (
                            <option value={status.value}>{status.key}</option>
                        ))}
                    </select>
                    )}
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='form_status' className='form-label'>
                        NodeORC Task Form status
                    </label>
                    {loading ? (
                        <div>Loading...</div> // Show loading indicator
                    ) : error ? (
                        <div className="text-danger">{error}</div> // Show error message
                    ) : (
                    <select name="form_status" id="form_status" className="form-select" onChange={handleFormStatusChange} value={deviceFormStatus} disabled>
                        {deviceFormStatuses.map((status) => (
                            <option value={status.value}>{status.key}</option>
                        ))}
                    </select>
                    )}
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='nodeorc_version' className='form-label'>
                        NodeORC version
                    </label>
                    <input type='text' className='form-control' id='nodeorc_version' name='nodeorc_version' onChange={handleInputChange} value={formData.nodeorc_version} readOnly/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='message' className='form-label'>
                        Message
                    </label>
                    <input type='text' className='form-control' id='message' name='message' onChange={handleInputChange} value={formData.message}/>
                </div>
                <button type='submit' className='btn btn-primary'>
                    Submit
                </button>

            </form>
       </div>

    );
};
export default DiskManagement;