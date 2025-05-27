import api from "../../api.js";
import React, {useEffect, useState} from "react";

const VideoConfigForm = (
  {
    selectedVideoConfig,
    setSelectedVideoConfig,
    video,
    cameraConfig,
    recipe,
    CSDischarge,
    CSWaterLevel,
    setCameraConfig,
    setRecipe,
    setCSDischarge,
    setCSWaterLevel,
    setMessageInfo
  }) => {
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


  const handleInputChange = async (event) => {
    const {name, value, type} = event.target;
    const updatedFormData = {
      ...formData,
      [name]: value
    }
    setFormData(updatedFormData);
  }


  const handleRotateChange = async (event) => {
    const value = event.target.value === "0" ? null : parseInt(event.target.value);
    // set the rotation correctly
    const updatedCameraConfig = {
      ...cameraConfig,
      rotation: value,
    };
    setCameraConfig(updatedCameraConfig);
    // set the rotation correctly
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    // collect data from all fields

    // Dynamically filter only fields with non-empty values
    const filteredData = Object.fromEntries(
      Object.entries(formData).filter(([key, value]) => value !== '' && value !== null)
    );
    if (formData.sample_video_id === undefined) {
      filteredData.sample_video_id = video.id;
    }
    // the entire video config is stored in one go
    if (CSDischarge?.name === undefined) {
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
    } else {
      filteredData.cross_section = null;
    }
    if (CSWaterLevel.features) {
      filteredData.cross_section_wl = CSWaterLevel
    } else {
      filteredData.cross_section_wl = null;
    }
    if (recipe.data) {
      filteredData.recipe = recipe
    } else {
      filteredData.recipe = null;
    }
    if (cameraConfig.data) {
      filteredData.camera_config = cameraConfig
    } else {
      filteredData.camera_config = null;
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
      } else {
        // set the updated camera config, recipe and cross-section details
        setSelectedVideoConfig(response.data);
      }
      setMessageInfo('success', 'Video config stored successfully');
    } catch (err) {
      setMessageInfo('Error while storing video config', err.response.data);
    } finally {
      // now also update the video where needed
      video.video_config_id = response.data.id;
      // and store this in the database
      api.patch(`/video/${video.id}`, {"video_config_id": response.data.id});
    }
  };


  return (
    <div style={{"padding": "5px"}}>
      <p>Let's get started with some simple details and getting the video rotated correcly.</p>
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
        <div className="mb-3 mt-3">
          <label htmlFor="videoMode" className="form-label">
            Mode of video
          </label>
          <div>
            <input
              type="radio"
              id="modePerspective"
              name="videoMode"
              onChange={handleInputChange}
              value="perspective"
              required
              checked={true}

            />
            <label htmlFor="modePerspective" style={{ marginLeft: '8px' }}>Full perspective with 6 or more points in x, y, z</label>
          </div>
          <div>
            <input
              type="radio"
              id="modeHomography"
              name="videoMode"
              onChange={handleInputChange}
              value="homography"
              required
              disabled={true}
              title="This option is not yet available, only full perspective is available so far."
            />
            <label htmlFor="modeHomography" style={{marginLeft: '8px'}} title="This option is not yet available">4
              points on a flat surface x, y only</label>
          </div>
          <div>
            <input
              type="radio"
              id="modeDrone"
              name="videoMode"
              onChange={handleInputChange}
              value="nadirDrone"
              required
              disabled={true}
              title="This option is not yet available, only full perspective is available so far."
            />
            <label htmlFor="modeDrone" style={{ marginLeft: '8px' }}>Nadir drone with 2 points x, y</label>
          </div>
        </div>
        <div className="mb-3 mt-3">
          <label htmlFor="videoMode" className="form-label">
            Rotate video
          </label>
          <div>
            <input
              type="radio"
              id="0deg"
              name="videoRotation"
              onChange={handleRotateChange}
              value="0"
              required
            />
            <label htmlFor="0deg" style={{ marginLeft: '8px' }}>no rotation</label>
          </div>
          <div>
            <input
              type="radio"
              id="90deg"
              name="videoRotation"
              onChange={handleRotateChange}
              value="90"
              required
            />
            <label htmlFor="90deg" style={{ marginLeft: '8px' }}>90 degrees clockwise</label>
          </div>
          <div>
            <input
              type="radio"
              id="270deg"
              name="videoRotation"
              onChange={handleRotateChange}
              value="270"
              required
            />
            <label htmlFor="270deg" style={{ marginLeft: '8px' }}>90 degrees counter-clockwise</label>
          </div>
          <div>
            <input
              type="radio"
              id="180deg"
              name="videoRotation"
              onChange={handleRotateChange}
              value="180"
              required
            />
            <label htmlFor="180deg" style={{ marginLeft: '8px' }}>180 degrees</label>
          </div>
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
