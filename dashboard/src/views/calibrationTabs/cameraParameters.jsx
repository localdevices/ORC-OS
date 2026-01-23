import {useEffect, useState} from 'react';
import PropTypes from "prop-types";
import {useDebouncedWsSender} from "../../api/api.js";

const CameraParameters = ({cameraConfig, setCameraConfig, ws}) => {
  const [camLocationAuto, setCamLocationAuto] = useState(false);
  const [camRotationAuto, setCamRotationAuto] = useState(false);
  const [camLensAuto, setCamLensAuto] = useState(false);
  const [formData, setFormData] = useState({
    camX: '',
    camY: '',
    camZ: '',
    camYaw: '',
    camPitch: '',
    camRoll: '',
    camF: '',
    camK1: '',
    camK2: ''
  });
  const sendDebouncedMsg = useDebouncedWsSender(ws, 400);

  useEffect(() => {
    if (cameraConfig) {
      // set the data wherever available
      setFormData({
        camX: cameraConfig?.camera_position?.[0] || '',
        camY: cameraConfig?.camera_position?.[1] || '',
        camZ: cameraConfig?.camera_position?.[2] || '',
        camYaw: cameraConfig?.camera_rotation?.[0] || '',
        camPitch: cameraConfig?.camera_rotation?.[1] || '',
        camRoll: cameraConfig?.camera_rotation?.[2] || '',
        camF: cameraConfig?.f || '',
        camK1: cameraConfig?.k1 || '',
        camK2: cameraConfig?.k2 || ''
      });
    } else {
      setFormData({
        camX: '',
        camY: '',
        camZ: '',
        camYaw: '',
        camPitch: '',
        camRoll: '',
        camF: '',
        camK1: '',
        camK2: ''
      })
    }


  }, [cameraConfig]);

  const updateCamConfig = async (updatedFields) => {
    setCameraConfig({
      ...cameraConfig,
      ...updatedFields
    });
    const videoPatch = {video_config: {camera_config: updatedFields}};
    const msg = {
      action: "update_video_config",
      op: "set_field",
      params: {
        video_patch: videoPatch
      }
    }
    sendDebouncedMsg(msg)

  }

  const updateCameraRotation = async (index, value) => {
    let cameraRotation;
    if (!cameraConfig?.camera_rotation) {
      // first set a zeros array
      cameraRotation = [0, 0, 0];
    } else {
      cameraRotation = cameraConfig.camera_rotation;
    }
    const newRotation = cameraRotation.map((item, i) => i === index ? value : item)
    const updatedFields = {camera_rotation: newRotation}
    await updateCamConfig(updatedFields)
  }

  const updateCameraPosition = (index, value) => {
    console.log("UPDATE CAM POS", index, value)
    let cameraPosition;
    if (!cameraConfig?.camera_position) {
      // first set a zeros array
      cameraPosition = [0, 0, 0]
    } else {
      cameraPosition = cameraConfig.camera_position;
    }
    const newPosition = cameraPosition.map((item, i) => i === index ? value : item)
    const updatedFields = {camera_position: newPosition}
    updateCamConfig(updatedFields)
  }

  const updateLensPars = async (event) => {
    const {name, value} = event.target;
    console.log("UPDATE LENS PARS", name, value)
    const fieldName = name.replace(/^cam/, '').toLowerCase();
    const parsedValue = parseFloat(value);
    const updatedFields = {[fieldName]: parsedValue};
    await updateCamConfig(updatedFields);
  }

  return (
    <div>
      <div className="split-screen three-columns">
        <div className="flex-container column">
          <h6>Camera location</h6>
          <div className="form-check">
            <label className="form-check-label">
              <input
                type="checkbox"
                className="form-check-input me-2"
                onChange={(e) => setCamLocationAuto(e.target.checked)}
                checked={camLocationAuto}
              />
              Fix
            </label>
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '40px'}}>
              x:
            </label>
            <input
              type="text"
              className="form-control"
              id="camX"
              disabled={camLocationAuto}
              onChange={(e) => updateCameraPosition(0, parseFloat(e.target.value))}
              value={formData.camX}

              // placeholder="distance from origin [m]"
            />
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '40px'}}>
              y:
            </label>
            <input
              type="text"
              className="form-control"
              id="camY"
              disabled={camLocationAuto}
              onChange={(e) => updateCameraPosition(1, parseFloat(e.target.value))}
              value={formData.camY}

              // placeholder="distance from origin [m]"
            />
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '40px'}}>
              z:
            </label>
            <input
              type="text"
              className="form-control"
              id="camZ"
              disabled={camLocationAuto}
              onChange={(e) => updateCameraPosition(2, parseFloat(e.target.value))}
              value={formData.camZ}
              // placeholder="distance from origin [m]"
            />
          </div>
        </div>
        <div className="flex-container column">
        <h6>Camera direction</h6>
          <div className="form-check">
            <label className="form-check-label">
              <input
                type="checkbox"
                className="form-check-input me-2"
                onChange={(e) => setCamRotationAuto(e.target.checked)}
                checked={camRotationAuto}
              />
              Fix
            </label>
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '60px'}}>
              yaw:
            </label>
            <input
              type="text"
              className="form-control"
              id="camYaw"
              disabled={camRotationAuto}
              onChange={(e) => updateCameraRotation(0, parseFloat(e.target.value))}
              value={formData.camYaw}

              // placeholder="distance from origin [m]"
            />
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '60px'}}>
              pitch:
            </label>
            <input
              type="text"
              className="form-control"
              id="camPitch"
              disabled={camRotationAuto}
              onChange={(e) => updateCameraRotation(1, parseFloat(e.target.value))}
              value={formData.camPitch}

              // placeholder="distance from origin [m]"
            />
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '60px'}}>
              roll:
            </label>
            <input
              type="text"
              className="form-control"
              id="camRoll"
              disabled={camRotationAuto}
              onChange={(e) => updateCameraRotation(2, parseFloat(e.target.value))}
              value={formData.camRoll}
              // placeholder="distance from origin [m]"
            />
          </div>

        </div>
        <div className="flex-container column">
        <h6>Lens parameters</h6>
          <div className="form-check">
            <label className="form-check-label">
              <input
                type="checkbox"
                className="form-check-input me-2"
                onChange={(e) => setCamLensAuto(e.target.checked)}
                checked={camLensAuto}
              />
              Fix
            </label>
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '40px'}}>
              f:
            </label>
            <input
              type="text"
              className="form-control"
              id="camF"
              name="camF"
              disabled={camLensAuto}
              value={formData.camF}
              onChange={updateLensPars}
            />
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '40px'}}>
              k1:
            </label>
            <input
              type="text"
              className="form-control"
              id="camK1"
              name="camK1"
              disabled={camLensAuto}
              value={formData.camK1}
              onChange={updateLensPars}
            />
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '40px'}}>
              k2:
            </label>
            <input
              type="text"
              className="form-control"
              id="camK2"
              name="camK2"
              disabled={camLensAuto}
              value={formData.camK2}
              onChange={updateLensPars}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
CameraParameters.propTypes = {
  cameraConfig: PropTypes.object.isRequired,
  setCameraConfig: PropTypes.func.isRequired,
};

export default CameraParameters;
