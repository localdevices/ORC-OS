import {useEffect, useState} from 'react';

const CameraParameters = ({cameraConfig, setCameraConfig}) => {
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

  const updateCameraRotation = (index, value) => {
    if (!cameraConfig?.camera_rotation) {
      // first set a zeros array
      setCameraConfig({
        ...cameraConfig,
        camera_rotation: [0, 0, 0]
      });
    }
    // Use a timeout to let the state update take effect before proceeding
    setTimeout(() => {
      setCameraConfig((prevConfig) => ({
        ...prevConfig,
        camera_rotation: prevConfig.camera_rotation.map((item, i) =>
          i === index ? value : item
        ),
      }));
    }, 0);
  }

  const updateCameraPosition = (index, value) => {
    if (!cameraConfig?.camera_position) {
      // first set a zeros array
      setCameraConfig({
        ...cameraConfig,
        camera_position: [0, 0, 0]
      });
    }
    // Use a timeout to let the state update take effect before proceeding
    setTimeout(() => {
      setCameraConfig((prevConfig) => ({
        ...prevConfig,
        camera_position: prevConfig.camera_position.map((item, i) =>
          i === index ? value : item
        ),
      }));
    }, 0);
  }


  const handleInputChange = (event) => {
    console.log(event);
    const value = event.target.value;
    setFormData({
      ...formData,
      [event.target.name]: parseFloat(value)
    });
    console.log("setting form data", formData);
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
              onChange={(e) => setCameraConfig({
                ...cameraConfig,
                f: parseFloat(e.target.value)
              })}
              // onChange={handleInputChange}
              // placeholder="distance from origin [m]"
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
              disabled={camLensAuto}
              value={formData.camK1}
              onChange={(e) => setCameraConfig({
                ...cameraConfig,
                k1: parseFloat(e.target.value)
              })}
              // placeholder="distance from origin [m]"
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
              disabled={camLensAuto}
              value={formData.camK2}
              onChange={(e) => setCameraConfig({
                ...cameraConfig,
                k2: parseFloat(e.target.value)
              })}
              // placeholder="distance from origin [m]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
export default CameraParameters;
