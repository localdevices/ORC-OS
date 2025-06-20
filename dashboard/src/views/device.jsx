import React, {useState, useEffect} from 'react';
import { Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js';

import api from '../api';
import {useMessage} from '../messageContext';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

const Device = () => {

    const [device, updateDevice] = useState([]);
    const [deviceStatuses, setDeviceStatuses] = useState([]);
    const [deviceStatus, setDeviceStatus] = useState(''); // State for the selected status
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
    // set message box
    const {setMessageInfo} = useMessage();

    const fetchDevice = async () => {
        const response = await api.get('/device/');
        updateDevice(response.data)
        setDeviceStatus(response.data.status);
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
    // helper function to get status name from status value
    const getStatusName = (statusValue) => {
        const status = deviceStatuses.find(s => s.value === statusValue);
        return status ? status.key : '';
    };
    useEffect(() => {
        fetchDevice();
        fetchDeviceStatuses();
    }, []);
    useEffect(() => {
        if (device) {
            setFormData({
                name: device.name || '',
                operating_system: device.operating_system || '',
                processor: device.processor || '',
                memory: device.memory || '',
                status: device.status,
                form_status: device.form_status,
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
    const handleFormSubmit = async (event) => {
        try {
            event.preventDefault();
            console.log(formData);
            const response = await api.post('/device/', formData);
            if (!response.status === 200) {
                const errorData = await response.json()
                throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
            }
            setMessageInfo('success', 'Device information updated successfully!');

            // read back the device after posting
            fetchDevice();
            // set the form data to new device settings
            setFormData({
                name: '',
                operating_system: '',
                processor: '',
                memory: '',
                status: '',
                orc_os_version: '',
                message: ''
            });
            setDeviceStatus(device.status);

        } catch (err) {
            setMessageInfo('error', err.response.data);
        }
    };
    // Prepare chart data
    const memoryChartData = {
        labels: ['Used Memory', 'Free Memory'],
        datasets: [
            {
                data: [device.used_memory, device.memory - device.used_memory],
                backgroundColor: [
                    'rgba(255, 99, 99, 0.8)',
                    'rgba(75, 192, 108, 0.8)',
                ],
                borderColor: [
                    'rgb(255,99,99)',
                    'rgba(75,192,108, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    const diskSpaceChartData = {
        labels: ['Used disk space', 'Free disk space'],
        datasets: [
            {
                data: [device.used_disk_space, device.disk_space - device.used_disk_space],
                backgroundColor: [
                    'rgba(255, 99, 99, 0.8)',
                    'rgba(75,147,192,0.8)',
                ],
                borderColor: [
                    'rgb(255,99,99)',
                    'rgba(75,147,192, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: {
                position: 'bottom',
            },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.raw || 0;
                        return `${label}: ${value.toFixed(2)} GB`;
                    }
                }
            }
        },
    };

    return (
        <div className='container'>
            Change your device name and check your device health.
            <hr/>
            <div className="flex-container">
                <div className="card">
                    <h4>Device status</h4>
                    <form onSubmit={handleFormSubmit}>
                        <div className='mb-3 mt-3'>
                            <label htmlFor='name' className='form-label'>
                                Change the name of your device
                            </label>
                            <input type='text' className='form-control' id='name' name='name' onChange={handleInputChange} value={formData.name}/>
                        </div>
                        <button type='submit' className='btn'>
                            Submit
                        </button>
                    </form>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                        <label>
                            Device status: {getStatusName(deviceStatus)}
                        </label>
                    </div>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                        <label>
                            Processor: {device.processor}
                        </label>
                        <div className="readonly">{status.key}</div>
                    </div>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                        <label>
                            ORC-OS version: {device.orc_os_version}
                        </label>
                        <div className="readonly">{status.key}</div>
                    </div>
                </div>
                <div className="card">
                    <h4>Resources use</h4>
                    <div className='mb-3 mt-3'>
                        <div className='text-center mt-2'>
                            <p>Memory usage: {parseFloat(device.used_memory).toFixed(2)} / {parseFloat(device.memory).toFixed(2)} GB</p>
                        </div>
                        <div style={{ maxWidth: '150px', margin: '0 auto' }}>
                            <Pie data={memoryChartData} options={chartOptions} />
                        </div>
                    </div>
                    <div className='text-center mt-2'>
                        <p>Disk usage: {parseFloat(device.used_disk_space).toFixed(2)} / {parseFloat(device.disk_space).toFixed(2)} GB</p>
                    </div>
                    <div className='mb-3 mt-3'>
                        <div style={{ maxWidth: '150px', margin: '0 auto' }}>
                            <Pie data={diskSpaceChartData} options={chartOptions} />
                        </div>
                    </div>
                </div>
            </div>
        </div>

    );
};
export default Device;
