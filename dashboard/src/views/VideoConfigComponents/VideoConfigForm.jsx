import {useEffect, useState} from "react";
import {useDebouncedWsSender} from "../../api/api.js";
import PropTypes from "prop-types";

const VideoConfigForm = (
  {
    selectedVideoConfig,
    video,
    cameraConfig,
    ws
  }) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  // create a delayed websocket sender for this component
  const sendDebouncedMsg = useDebouncedWsSender(ws, 400);

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

    } catch (err) {
      console.error('Error storing video config:', err.response.data.detail);
    } finally {
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

VideoConfigForm.propTypes = {
  selectedVideoConfig: PropTypes.object.isRequired,
  video: PropTypes.object.isRequired,
  cameraConfig: PropTypes.object.isRequired,
  ws: PropTypes.object.isRequired,
};

export default VideoConfigForm;
