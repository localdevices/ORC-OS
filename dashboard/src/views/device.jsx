import {useState, useEffect} from 'react';
import { Pie } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend
} from 'chart.js';

import api from '../api/api.js';

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

    const fetchDevice = async () => {
        const randomQuery = `cacheBust=${Date.now()}`
        const response = await api.get(`/device/?${randomQuery}`);
        updateDevice(response.data)
        setDeviceStatus(response.data.status);
    };
    const fetchDeviceStatuses = async () => {
        const randomQuery = `cacheBust=${Date.now()}`
        try {
            const response = await api.get(`/device/statuses/?${randomQuery}`);
            setDeviceStatuses(response.data); // Assuming API returns array of statuses
        } catch (err) {
            console.log(`Failed to fetch device statuses. ${err}`);
        }
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
                align: 'start'
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
      <div className="container">
          <h2>Device info</h2>
          Check the status of the device
          <div className="split-screen flex">
              <div className="flex-container column" style={{height: "calc(100vh - 250px)", minHeight: "800px"}}>
                  <h4>Device status</h4>
                  <div className='mb-0 mt-3'>
                      <label htmlFor='name' className='form-label'>
                          ORC-OS version
                      </label>
                      <input type='text' className='form-control' id='name' name='name' value={device.orc_os_version} disabled/>
                  </div>
                  <div className='mb-0 mt-3'>
                      <label htmlFor='name' className='form-label'>
                          ORC-OS release name
                      </label>
                      <input type='text' className='form-control' id='name' name='name' value={device.orc_os_release} disabled/>
                  </div>
                  <div className='mb-0 mt-3'>
                      <label htmlFor='name' className='form-label'>
                          Hostname of the device
                      </label>
                      <input type='text' className='form-control' id='name' name='name' value={device.hostname} disabled/>
                  </div>
                  <div className='mb-0 mt-3'>
                      <label htmlFor='name' className='form-label'>
                          Local IP address of the device
                      </label>
                      <input type='text' className='form-control' id='name' name='name' value={device.ip_address} disabled/>
                  </div>
                  <div className='mb-0 mt-3'>
                      <label htmlFor='name' className='form-label'>
                          Device processor
                      </label>
                      <input type='text' className='form-control' id='name' name='name' value={device.processor} disabled/>
                  </div>
                  <div className='mb-3 mt-3'>
                      <label htmlFor='name' className='form-label'>
                          Device processor
                      </label>
                      <input type='text' className='form-control' id='name' name='name' value={device.processor} disabled/>
                  </div>
              </div>
              <div className="flex-container column"  style={{height: "calc(100vh - 250px)", minHeight: "800px"}}>
                  <h4>Resources use</h4>
                  <div className='mb-3 mt-3'>
                      <div className='text-center mt-2'>
                          <p>Memory usage: {parseFloat(device.used_memory).toFixed(2)} / {parseFloat(device.memory).toFixed(2)} GB</p>
                      </div>
                      <div style={{ maxWidth: '250px', margin: '0 auto' }}>
                          <Pie data={memoryChartData} options={chartOptions} />
                      </div>
                  </div>
                  <div className='text-center mt-2'>
                      <p>Disk usage: {parseFloat(device.used_disk_space).toFixed(2)} / {parseFloat(device.disk_space).toFixed(2)} GB</p>
                  </div>
                  <div className='mb-3 mt-3'>
                      <div style={{ maxWidth: '250px', margin: '0 auto' }}>
                          <Pie data={diskSpaceChartData} options={chartOptions} />
                      </div>
                  </div>
              </div>
          </div>

      </div>

    );
};
export default Device;
