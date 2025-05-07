import api from "../../api.js";
import React, {useEffect, useState} from "react";

const VideoConfigForm = ({selectedVideoConfig, setSelectedVideoConfig, cameraConfig, recipe, CSDischarge, CSWaterLevel, setMessageInfo}) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
  });
  useEffect(() => {
    if (selectedVideoConfig) {
      setFormData({
        name: selectedVideoConfig.name || '',
        id: selectedVideoConfig.id || '',
      });
    } else {
      setFormData({
        name: '',
        id: '',
      })
    }

  }, [selectedVideoConfig]);

  // // Utility function to safely parse JSON
  // const safelyParseJSON = (jsonString) => {
  //   try {
  //     return JSON.parse(jsonString); // Parse if valid JSON string
  //   } catch (error) {
  //     console.warn("Invalid JSON string:", error);
  //     return jsonString; // Fallback: Leave it as the original string
  //   }
  // };

  const handleInputChange = async (event) => {
    const {name, value, type} = event.target;
    const updatedFormData = {
      ...formData,
      [name]: value
    }
    setFormData(updatedFormData);
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    // collect data from all fields

    // Dynamically filter only fields with non-empty values
    const filteredData = Object.fromEntries(
      Object.entries(formData).filter(([key, value]) => value !== '' && value !== null)
    );
    // the entire video config is stored in one go
    if (CSDischarge?.name === undefined) {
      console.log(filteredData)
      CSDischarge.name = filteredData.name;
    }
    if (CSWaterLevel?.name === undefined) {
      CSWaterLevel.name = filteredData.name;
    }
    if (recipe?.name === undefined) {
      recipe.name = filteredData.name;
    }
    if (cameraConfig?.name === undefined) {
      cameraConfig.name = filteredData.name;
    }
    if (CSDischarge.features) {
      filteredData.cross_section = CSDischarge
    }
    if (CSWaterLevel.features) {
      filteredData.cross_section_wl = CSWaterLevel
    }
    if (recipe.data) {
      filteredData.recipe = recipe
    }
    if (cameraConfig.data) {
      filteredData.camera_config = cameraConfig
    }

    // predefine response object
    let response;
    try {
      console.log(filteredData);
      response = await api.post('/video_config/', filteredData);
      console.log(response);
      if (response.status !== 201 && response.status !== 200) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
      }
      setMessageInfo('success', 'Video config stored successfully');
    } catch (err) {
      setMessageInfo('Error while storing video config', err.response.data);
    }
  };


  return (
    <div style={{"padding": "5px"}}>
      <p>Name for VideoConfig</p>
      <form onSubmit={handleFormSubmit}>
        <div className='mb-3 mt-3'>
          <label htmlFor='id' className='form-label'>
            Video Config ID
          </label>
          <input type='str' className='form-control' id='id' name='id' value={formData.id} disabled/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='name' className='form-label'>
            Name of video configuration
          </label>
          <input type='str' className='form-control' id='name' name='name' onChange={handleInputChange}
                 value={formData.name} required/>
        </div>
        <button type='submit' className='btn'>
          Save
        </button>
      </form>
    </div>

  )

};

import PropTypes from "prop-types";

VideoConfigForm.propTypes = {
  selectedVideoConfig: PropTypes.object,
  setSelectedVideoConfig: PropTypes.func,
  cameraConfig: PropTypes.object,
  recipe: PropTypes.object,
  CSDischarge: PropTypes.object,
  CSWaterLevel: PropTypes.object,
  setMessageInfo: PropTypes.func,
};

export default VideoConfigForm;
