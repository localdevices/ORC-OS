import {useState, useEffect} from 'react';
import api from '../api';
import {useMessage} from '../messageContext';
import MessageBox from '../messageBox';

const WaterLevel = () => {
    const [scriptTypeStatus, setScriptTypeStatus] = useState([]);
    const [waterLevel, updateWaterLevel] = useState([]);
    const [formData, setFormData] = useState({
        created_at: '',
        datetime_fmt: '',
        file_template: '',
        frequency: '',
        script_type: '',
        script: ''
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
                datetime_fmt: waterLevel.datetime_fmt,
                file_template: waterLevel.file_template,
                frequency: waterLevel.frequency || null,
                script_type: waterLevel.script_type || null,
                script: waterLevel.script
            });
        }
    }, [waterLevel]);
    const handleInputChange = (event) => {
        const { name, value, type } = event.target;
        event.target.value = value;
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
            // read back the device after posting
            fetchWaterLevel();
            // set the form data to new device settings
            setFormData({
                created_at: '',
                datetime_fmt: '',
                file_template: '',
                frequency: '',
                script_type: '',
                script: ''
            });
        } catch (err) {
          setMessageInfo("error", err.response.data);
        }
    };
    return (
        <div className='container'>
            Change your water level settings. You can let NodeORC read and store water levels automatically using
            a user-defined script or as fall-back, read water levels from a file or files with a datetime template.
            <MessageBox/>

            <hr/>
            <form onSubmit={handleFormSubmit}>
                <div className='mb-3 mt-3'>
                    <label htmlFor='created_at' className='form-label'>
                        Date of creation
                    </label>
                    <input type='datetime-local' className='form-control' id='created_at' name='created_at' onChange={handleInputChange} value={formData.created_at} disabled/>
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='datetime_fmt' className='form-label'>
                        Date/time format used in backup files (if you have any)
                    </label>
                    <input type='str' className='form-control' id='datetime_fmt' name='datetime_fmt' placeholder="%Y-%m-%dT%H:%M:%SZ" onChange={handleInputChange} value={formData.datetime_fmt} />
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='file_template' className='form-label'>
                        File template format for water level files (e.g. water_level_&#123;%Y%m%d&#125;.csv). These files will we
                        expected in &lt;home folder&gt;/water_level.
                    </label>
                    <input type='str' className='form-control' id='file_template' name='file_template' placeholder="water_level_&#123;%Y%m%d&#125;.csv" onChange={handleInputChange} value={formData.file_template} />
                </div>
                <div className='mb-3 mt-3'>
                    <label htmlFor='frequency' className='form-label'>
                        Frequency [s] for checking for new water level using the script.
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
                <button type='submit' className='btn'>
                    Submit
                </button>
            </form>
       </div>

    );
};
export default WaterLevel;