import {useEffect, useRef, useState} from "react";
import {useDebouncedWsSender} from "../../api/api.js";

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
    setSave,
    setMessageInfo,
    ws
  }) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // create a delayed websocket sender for this component
  const sendDebouncedMsg = useDebouncedWsSender(ws, 400);
  //
  // useEffect(() => {
  //   // Create debounced function once
  //   let timeout;
  //   sendUpdateDebouncedRef.current = ({ msg }) => {
  //     clearTimeout(timeout);
  //     timeout = setTimeout(() => {
  //       ws.sendJson(msg);
  //     }, 400); // wait 400 ms before sending
  //   };
  //
  //   // Cleanup on unmount
  //   return () => clearTimeout(timeout);
  // }, [ws]); // if ws is stable, this runs only once

  useEffect(() => {
    if (selectedVideoConfig) {
      setFormData({
        name: selectedVideoConfig.name || '',
        id: selectedVideoConfig.id || '',
        sync_status: selectedVideoConfig.sync_status || 1,
        sample_video_id: selectedVideoConfig.sample_video_id || video.id,
      });
    } else {
      setFormData({
        name: '',
        id: '',
        sync_status: 1,
        sample_video_id: null,
      })
    }

  }, [selectedVideoConfig]);


  const handleInputChange = async (event) => {
    const { name, value } = event.target;
    // update local state immediately so UI is snappy
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    const msg = {
      "action": "update_video_config",
      "op": "set_field",
      "params": {"video_patch": {"video_config": {[name]: value}}}
    }
    // send change off to backend
    sendDebouncedMsg(msg);
    // // schedule ws update
    // if (sendUpdateDebouncedRef.current) {
    //   sendUpdateDebouncedRef.current({ msg });
    // }
  }

  const handleRotateChange = async (event) => {
    const value = event.target.value === "0" ? null : parseInt(event.target.value);
    // set the rotation correctly
    ws.sendJson({"action": "update_video_config", "op": "set_rotation", "params": {"rotation": value}})
  }

  const handleFormSubmit = async (event) => {
    setIsSaving(true);
    event.preventDefault();
    try {
      ws.sendJson({"action": "save", "params": {"name": formData.name}});

    // collect data from all fields

    // // Dynamically filter only fields with non-empty values
    // const filteredData = Object.fromEntries(
    //   Object.entries(formData).filter(([key, value]) => value !== '' && value !== null)
    // );
    // console.log("FORMDATA VID-CONFIG: ", formData);
    // if (formData.sample_video_id === undefined) {
    //   console.log("SAMPLE VIDEO UNDEFINED")
    //   filteredData.sample_video_id = video.id;
    // }
    // if (formData.sync_status !== 1) {
    //   filteredData.sync_status = 3;  // update sync status
    // } else {
    //   filteredData.sync_status = 1;  // if video config is new, don't update
    // }
    // // the entire video config is stored in one go
    // if (Object.keys(CSDischarge).length > 0 && CSDischarge?.name === undefined) {
    //   CSDischarge.name = filteredData.name;
    // }
    // if (Object.keys(CSWaterLevel).length > 0 && CSWaterLevel?.name === undefined) {
    //   CSWaterLevel.name = filteredData.name;
    // }
    // if (recipe?.name === undefined) {
    //   recipe.name = filteredData.name;
    // }
    // if (cameraConfig?.name === undefined) {
    //   cameraConfig.name = filteredData.name;
    // }
    // if (CSDischarge.features) {
    //   filteredData.cross_section = CSDischarge
    // } else {
    //   filteredData.cross_section = null;
    // }
    // if (CSWaterLevel.features) {
    //   filteredData.cross_section_wl = CSWaterLevel
    // } else {
    //   filteredData.cross_section_wl = null;
    // }
    // if (recipe.data) {
    //   filteredData.recipe = {
    //     ...recipe,
    //     sync_status: recipe.sync_status === 1 ? 1 : 3  // replace sync status
    //   }
    // } else {
    //   filteredData.recipe = null;
    // }
    // if (cameraConfig.data) {
    //   const {isCalibrated, isPoseReady, ...cameraConfigWithoutCalibrated} = cameraConfig;
    //   filteredData.camera_config = cameraConfigWithoutCalibrated
    // } else {
    //   filteredData.camera_config = null;
    // }
    // // predefine response object
    // let response;
    // try {
    //   response = await api.post('/video_config/', filteredData);
    //   if (response.status !== 201 && response.status !== 200) {
    //     const errorData = await response.json()
    //     throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
    //   } else {
    //     // set the updated camera config, recipe and cross-section details
    //     setSelectedVideoConfig(response.data);
    //     // also set the camera config id and recipe id
    //     setCameraConfig({
    //         ...cameraConfig,
    //         id: response.data.camera_config.id,
    //         name: response.data.camera_config.name
    //     });
    //     setRecipe({
    //         ...recipe,
    //         id: response.data.recipe.id,
    //         name: response.data.recipe.name,
    //         sync_status: response.data.recipe.sync_status
    //     });
    //   }
      setMessageInfo('success', 'Video config stored successfully');
    } catch (err) {
      setMessageInfo('error', `Error while storing video config ${err.response.data.detail}`);
    } finally {
      // try {
      //   // now also update the video where needed
      //   video.video_config_id = response.data.id;
      //   // and store this in the database
      //   await api.patch(`/video/${video.id}`, {"video_config_id": response.data.id});
        // ensure saving is set to false (only when successful
        // setSave(false);
      // } catch (err) {
      //   console.log(`Failed to set video config id for video ${video.id} due to ${err}`);
      // } finally {
        // ensure the view port is opened for edits in all cases
        setIsSaving(false);
      }
    }


  return (
    <div className='container tab'>
      {isSaving && (
        <div className="spinner-viewport">
          <div className="spinner" />
          <div>Saving...</div>
        </div>
      )}
      <h5>General information</h5>
      <p>Get started with some simple details and getting the video rotated correctly. First save before you continue!</p>
      <form id="videoConfigForm" onSubmit={handleFormSubmit}>
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
              // onChange={handleInputChange}
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
              // onChange={handleInputChange}
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
              // onChange={handleInputChange}
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
              checked={!cameraConfig?.rotation || cameraConfig?.rotation === 0 || cameraConfig?.rotation === null}
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
              checked={cameraConfig?.rotation === 90 }
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
              checked={cameraConfig?.rotation === 270 }
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
              checked={cameraConfig?.rotation === 180 }
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
  ws: PropTypes.object
};

export default VideoConfigForm;
