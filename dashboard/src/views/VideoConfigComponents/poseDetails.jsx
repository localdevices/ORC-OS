import api from "../../api.js";
import React, {useEffect, useState} from "react";
import PropTypes from "prop-types";
import '../cameraAim.scss'
import {DropdownMenu} from "../../utils/dropdownMenu.jsx";

const PoseDetails = ({selectedCameraConfig, setSelectedCameraConfig, setMessageInfo}) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    data: ''
  });

  useEffect(() => {
    if (selectedCameraConfig) {
      setFormData({
        name: selectedCameraConfig.name || '',
        id: selectedCameraConfig.id || '',
        data: JSON.stringify(selectedCameraConfig.data, null, 4) || '',
      });
    } else {
      setFormData({
        name: '',
        id: '',
        data: '',
      })
    }

  }, [selectedCameraConfig]);

  // Utility function to safely parse JSON
  const safelyParseJSON = (jsonString) => {
    try {
      return JSON.parse(jsonString); // Parse if valid JSON string
    } catch (error) {
      console.warn("Invalid JSON string:", error);
      return jsonString; // Fallback: Leave it as the original string
    }
  };

  const submitData = (formData) => {
    return {
      id: formData.id || null,
      name: formData.name,
      data: safelyParseJSON(formData.data),
    }
  }

  const handleInputChange = async (event) => {
    const {name, value, type} = event.target;
    const updatedFormData = {
      ...formData,
      [name]: value
    }
    setFormData(updatedFormData);

    try {
      const response = await api.post('/camera_config/update/', submitData(updatedFormData));
      setSelectedCameraConfig(response.data);
    } catch (error) {
      console.error('Error updating JSON:', error);
    }
  }
  const loadModal = async () => {
    const input = document.createElement('input');
    input.type = "file";
    input.accept = ".json";
    const url = '/camera_config/from_file/'
    // Wait for the user to select a file
    input.addEventListener('change', async (event) => {

      // input.onchange = async (event) => {
      const file = event.target.files[0]; // Get the selected file
      if (file) {
        const formData = new FormData(); // Prepare form data for file upload
        formData.append("file", file);

        try {
          const response = await api.post(
            url,
            formData,
            {headers: {"Content-Type": "multipart/form-data",},}
          );
          if (response.status === 201) {
            // set the camera config data (only data, not id and name)
            setSelectedCameraConfig(prevState => ({
              ...prevState,
              data: response.data.data
            }))
            // setSelectedCameraConfig(response.data);
          } else {
            console.error("Error occurred during file upload:", response.data);
            setMessageInfo('error', response.data.detail);

          }
        } catch (error) {
          console.error("Error occurred during file upload:", error);
          setMessageInfo('error', `Error: ${error.response.data.detail}`);
        }

      }
    });
    // trigger input dialog box to open
    input.click();
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    // Dynamically filter only fields with non-empty values
    const filteredData = Object.fromEntries(
      Object.entries(formData).filter(([key, value]) => value !== '' && value !== null)
    );
    // predefine response object
    let response;
    try {
      console.log(submitData(filteredData));

      if (filteredData.id === undefined) {
        response = await api.post('/camera_config/', submitData(filteredData));
      } else {
        response = await api.patch(`/recipe/${filteredData.id}`, submitData(filteredData));
      }
      console.log(response);
      if (response.status !== 201 && response.status !== 200) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
      }
      setMessageInfo('success', 'Camera config stored successfully');
    } catch (err) {
      setMessageInfo('Error while storing camera config', err.response.data);
    }
  };


  return (
    <div className="split-screen" style={{overflow: 'auto'}}>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Set references</h5>
        <div className='mb-3 mt-3'>
          <label htmlFor='z_0' className='form-label small'>
            Water level in GCP axes [m]
          </label>
          <input type='number' className='form-control' id='z_0' name='z_0' onChange={handleInputChange} value="" required/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='h_ref' className='form-label small'>
            Water level local gauge [m]
          </label>
          <input type='number' className='form-control' id='h_ref' name='h_ref' onChange={handleInputChange} value="" required/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='crs' className='form-label small'>
            Coordinate reference system (only for GPS)
          </label>
          <input type='number' className='form-control' id='crs' name='crs' onChange={handleInputChange} value="" required/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='videoMode' className='form-label small'>
            Mode of video
          </label>
          <input type='radio' id='videoMode' name='videoMode' onChange={handleInputChange} value="1" required/>
        </div>
      </div>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Side view situation</h5>
        <p>intentionally left blanc</p>
      </div>
    </div>

  )

};

export default PoseDetails;
