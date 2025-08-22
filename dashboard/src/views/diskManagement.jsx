import {useState, useEffect} from 'react';
import api from '../api/api.js';
import {useMessage} from '../messageContext';

const DiskManagement = ({setRequiresRestart}) => {

    const [diskManagement, updateDiskManagement] = useState([]);
    const [formData, setFormData] = useState({
        created_at: '',
        min_free_space: '',
        critical_space: '',
        frequency: ''
    });
    // set message box
    const {setMessageInfo} = useMessage();

    const fetchDiskManagement = async () => {
        const response = await api.get('/disk_management/');
        updateDiskManagement(response.data);
    };
    useEffect(() => {
        fetchDiskManagement();
    }, []);
    useEffect(() => {
        if (diskManagement) {
            if (diskManagement.created_at) {
                diskManagement.created_at = diskManagement.created_at.slice(0, 19);
                }
            setFormData({
                created_at: diskManagement.created_at || '',
                min_free_space: diskManagement.min_free_space || '',
                critical_space: diskManagement.critical_space || '',
                frequency: diskManagement.frequency || ''
            });
        }
    }, [diskManagement]);
    const handleInputChange = (event) => {
        const { name, value, type } = event.target;
        event.target.value = value;
        // const parsedValue = type === "number" ? parseFloat(value) : value
        const parsedValue = type === "number" ? (value === "" ? "" : parseFloat(value)) : value
        setFormData({
            ...formData,
            [name]: parsedValue
        });
    };
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        // Dynamically filter only fields with non-empty values
        const filteredData = Object.fromEntries(
            Object.entries(formData).filter(([, value]) => value !== '' && value !== null)
        );

        // get rid of created_at field as this must be autocompleted
        try {
            delete filteredData.created_at;
            const response = await api.post(
              '/disk_management/', {
                min_free_space: filteredData.min_free_space,
                critical_space: filteredData.critical_space,
                frequency: filteredData.frequency,
              },
              {
                headers: { 'Content-Type': 'application/json' },
                withCredentials: true,
              }
            );
            if (!response.status === 200) {
                const errorData = await response.json()
                throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
            }
            setMessageInfo('success', 'Disk management updated successfully');
            setRequiresRestart(true);
            // read back the device after posting
            fetchDiskManagement();
            // set the form data to new device settings
            setFormData({
                created_at: '',
                min_free_space: '',
                critical_space: '',
                frequency: '',
            });
        } catch (err) {
            setMessageInfo('Error while updating Disk Management', err.response.data);
        }
    };
    return (
        <div className='container'>
            <h2>Change your disk management settings.</h2>
            <div className="flex-container column">
            <form onSubmit={handleFormSubmit}>
                <div className='mb-3 mt-3'>
                    <label htmlFor='created_at' className='form-label'>
                        Date of creation
                    </label>
                    <input type='datetime-local' className='form-control' id='created_at' name='created_at' onChange={handleInputChange} value={formData.created_at} disabled/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='min_free_space' className='form-label'>
                        Minimum space [GB] below which cleanup will take place
                    </label>
                    <input type='number' className='form-control' id='min_free_space' name='min_free_space' step="0.1" onChange={handleInputChange} value={formData.min_free_space} />
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='critical_space' className='form-label'>
                        Critical space [GB] below which service will be turned off.
                    </label>
                    <input type='number' className='form-control' id='critical_space' name='critical_space' step="0.1" onChange={handleInputChange} value={formData.critical_space} />
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='frequency' className='form-label'>
                        Frequency [s] for checking space and performing cleanup.
                    </label>
                    <input type='number' className='form-control' id='frequency' name='frequency' step="1" onChange={handleInputChange} value={formData.frequency} />
                </div>
                <button type='submit' className='btn'>
                    Submit
                </button>

                   <div>
                </div>

            </form>
            </div>
       </div>

    );
};
export default DiskManagement;
