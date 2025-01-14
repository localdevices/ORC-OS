import React, {useState, useEffect} from 'react';
import api from '../api';

const DiskManagement = () => {

    const [diskManagement, updateDiskManagement] = useState([]);
    const [loading, setLoading] = useState(true); // State for loading indicator
    const [message, setMessage] = useState(null); // State for message handling
    const [messageType, setMessageType] = useState(null); // State for message type
    const [folderName, setFolderName] = useState("");
    const [formData, setFormData] = useState({
        created_at: '',
        home_folder: '',
        min_free_space: '',
        critical_space: '',
        frequency: '',
    });

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
                home_folder: diskManagement.home_folder || '',
                min_free_space: diskManagement.min_free_space || '',
                critical_space: diskManagement.critical_space || '',
                frequency: diskManagement.frequency || ''
            });
        }
    }, [diskManagement]);
    const handleInputChange = (event) => {
        const { name, value, type } = event.target;
        event.target.value = value;
        setFormData({
            ...formData,
            [name]: type === "number" ? parseFloat(value) : value
        });
    };
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        // get rid of created_at field as this must be autocompleted
        try {
            delete formData.created_at;
            const response = await api.post('/disk_management/', formData);
            if (response.status === 500) {
                const errorData = await response.json()
                throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
            }
            setMessage("Disk management updated successfully!");
            setMessageType("success");
            // read back the device after posting
            fetchDiskManagement();
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
        } catch (err) {
            setMessage(err.response.data);
            setMessageType("error")
        } finally {
            // Clear message after 5 seconds
            setTimeout(() => {
              setMessage("");
              setMessageType("");
            }, 5000);
        }


    };
    return (
        <div className='container'>
            Change your disk management settings.
            <hr/>
            <form onSubmit={handleFormSubmit}>
                <div className='mb-3 mt-3'>
                    <label htmlFor='created_at' className='form-label'>
                        Date of creation
                    </label>
                    <input type='datetime-local' className='form-control' id='created_at' name='created_at' onChange={handleInputChange} value={formData.created_at} disabled/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='home_folder' className='form-label'>
                        Home folder
                    </label>
                    <div className='input-group custom-file-button'>
                      <label className='input-group-text' htmlFor='home_folder'>Type folder path:</label>
                      <input type='str' className='form-control' id='home_folder' name='home_folder' onChange={handleInputChange} value={formData.home_folder} />
                    </div>
{/*                     <input type='file' className='form-control custom-file-button' directory='' webkitdirectory='' id='home_folder' name='home_folder' onChange={handleInputChange} value={formData.home_folder} /> */}
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='critical_space' className='form-label'>
                        Critical space [GB] below which cleanup will take place
                    </label>
                    <input type='number' className='form-control' id='critical_space' name='critical_space' step="0.1" onChange={handleInputChange} value={formData.critical_space} />
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='min_free_space' className='form-label'>
                        Minimum space [GB] below which service will be turned off.
                    </label>
                    <input type='number' className='form-control' id='min_free_space' name='min_free_space' step="0.1" onChange={handleInputChange} value={formData.min_free_space} />
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='frequency' className='form-label'>
                        Frequency [s] for checking space and performing cleanup.
                    </label>
                    <input type='number' className='form-control' id='frequency' name='frequency' step="1" onChange={handleInputChange} value={formData.frequency} />
                </div>
                <button type='submit' className='btn btn-primary'>
                    Submit
                </button>

                   <div>
                </div>

            </form>

          {message && (
            <div style={{ color: messageType === "error" ? "red": "green", marginTop: "1rem" }}>
              <p>{message}</p>
            </div>
          )}

       </div>

    );
};
export default DiskManagement;