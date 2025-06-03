import api from "../../api.js";
import React, {useEffect, useState} from "react";
import PropTypes from "prop-types";
import '../cameraAim.scss'

const CameraConfigForm = ({selectedCameraConfig, setSelectedCameraConfig, setMessageInfo}) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    data: ''
  });
  const [showJsonData, setShowJsonData] = useState(false);

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
            // setSelectedCameraConfig(prevState => ({
            //     ...prevState,
            //     data: response.data.data
            //   }))
            const { id, name, remote_id, created_at, sync_status, ...updatedData } = response.data
            setSelectedCameraConfig(updatedData);
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
    <div style={{"padding": "5px"}}>
      <p>control points widgets, href/z0, 3d plot of situation</p>

      <button className="btn btn-primary" onClick={loadModal}
      >
        Load from JSON
      </button>
      <form onSubmit={handleFormSubmit}>
        <div className='mb-3 mt-3'>
          <label htmlFor='id' className='form-label'>
            Camera Config ID
          </label>
          <input type='str' className='form-control' id='id' name='id' value={formData.id} disabled />
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='name' className='form-label'>
            Name of camera configuration
          </label>
          <input type='str' className='form-control' id='name' name='name' onChange={handleInputChange} value={formData.name} required />
        </div>
        <button type='submit' className='btn'>
          Save
        </button>
        <div className='mb-3 mt-3'>Toggle JSON edits (advanced users only)
          <div className="form-check form-switch">
            <label className="form-label" htmlFor="toggleJson" style={{ marginLeft: '0' }}></label>
            <input
              style={{width: "40px", height: "20px", borderRadius: "15px"}}
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="toggleJson"
              onClick={() => setShowJsonData(!showJsonData)}
            />
          </div>
        </div>

        {showJsonData && (
          <div className="mb-3">
            <label htmlFor="data" className="form-label">JSON Data</label>
            <textarea
              id="data"
              className="form-control"
              rows="40"
              value={formData.data}
              onChange={handleInputChange}
            ></textarea>
          </div>
        )}
        <div>
        </div>

      </form>
    </div>

  )

};

export default CameraConfigForm;
