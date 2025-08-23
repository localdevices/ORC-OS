import {useState, useEffect} from 'react';
import api from '../api/api.js';
import {useMessage} from '../messageContext';

const WaterLevel = ({setRequiresRestart}) => {
    const [scriptTypeStatus, setScriptTypeStatus] = useState([]);
    const [waterLevel, updateWaterLevel] = useState([]);
    const [formData, setFormData] = useState({
        created_at: '',
        frequency: '',
        script_type: '',
        script: '',
        optical: false
    });
    // set up message box
    const {setMessageInfo} = useMessage();

    const fetchWaterLevel = async () => {
        const response = await api.get('/water_level/');
        updateWaterLevel(response.data);
    };
    useEffect(() => {
        fetchWaterLevel();
    }, []);
    useEffect(() => {
        if (waterLevel) {
            if (waterLevel.created_at) {
                waterLevel.created_at = waterLevel.created_at.slice(0, 19);
                }
            setFormData({
                created_at: waterLevel.created_at || '',
                frequency: waterLevel.frequency || null,
                script_type: waterLevel.script_type || null,
                script: waterLevel.script,
                optical: waterLevel.optical || false,
            });
        }
    }, [waterLevel]);
    const handleInputChange = (event) => {
        const { name, type } = event.target;
        const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
        setFormData({
            ...formData,
            [name]: type === "number" ? parseFloat(value) : value
        });
    };
    const handleInputIntChange = (event) => {
        console.log(event.target);
        const { name, value, type } = event.target;
        event.target.value = value;
        setFormData({
            ...formData,
            [name]: type === "number" | type === "select-one" ? parseInt(value) : value
        });
    };
    const handleScriptTypeChange = (e) => {
        setScriptTypeStatus(e.target.value); // Update selected status in state
        handleInputIntChange(e); // Pass the change event to the parent handler
    };

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        console.log(formData);
        // get rid of created_at field as this must be autocompleted
        try {
            delete formData.created_at;
            const response = await api.post('/water_level/', formData);
            if (response.status === 500) {
                const errorData = await response.json()
                console.log(response);
                throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
            }
            setMessageInfo("success", "Water level settings updated successfully!");
            setRequiresRestart(true);

          // read back the device after posting
            fetchWaterLevel();
            // set the form data to new device settings
            setFormData({
                created_at: '',
                frequency: '',
                script_type: '',
                script: '',
                optical: ''
            });
        } catch (err) {
          setMessageInfo("error", err.response.data);
        }
    };
    return (
        <div className='container'>
            Change your water level settings. You can let ORC-OS read and store water levels automatically using
            a user-defined script.
            <hr/>
            <form onSubmit={handleFormSubmit}>
                <div className='mb-3 mt-3'>
                    <label htmlFor='created_at' className='form-label'>
                        Date of creation or last update.
                    </label>
                    <input type='datetime-local' className='form-control' id='created_at' name='created_at' onChange={handleInputChange} value={formData.created_at} disabled/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='frequency' className='form-label'>
                        Frequency [s] for checking for new water level using the script. E.g. a value of 1800 checks every half hour.
                    </label>
                    <input type='number' className='form-control' id='frequency' name='frequency' step="1" onChange={handleInputChange} value={formData.frequency} />
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='script_type' className='form-label'>
                        Script type of the provided script.
                    </label>
                    <select name="script_type" id="script_type" className="form-select" onChange={handleScriptTypeChange} value={scriptTypeStatus}>
                        <option value="0">PYTHON</option>
                        <option value="1">BASH</option>
                    </select>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='script' className='form-label'>
                        Script content. The script should produce a last line with the water level in the following
                        form: &lt;%Y-%m-%dT%H:%M%SZ&gt;, &lt;value&gt;
                    </label>
{/*                     <input type='text' className='form-control' id='script' name='script' placeholder="#!/bin/bash&#10;...write your script" onChange={handleInputChange} value={formData.script} style={{ height: '300px' }}/> */}
                    <textarea className='form-control' id='script' name='script' placeholder="#!/bin/bash&#10;...write your script" onChange={handleInputChange} value={formData.script} style={{ height: '300px' }}/>
                </div>
                <div className='mb-3 mt-3'>
                    <input
                      type='checkbox'
                      className='form-check-input'
                      id='optical'
                      name='optical'
                      onChange={handleInputChange}
                      value={formData.optical}
                      checked={formData.optical}
                      style={{marginRight: '10px'}}
                    />
                    <label htmlFor='optical' className='form-label'>
                        Allow attempting to resolve water levels optically
                    </label>
                </div>
                <button type='submit' className='btn'>
                    Submit
                </button>
            </form>
       </div>

    );
};
export default WaterLevel;
