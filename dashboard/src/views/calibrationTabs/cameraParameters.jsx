import {useState} from 'react';

const CameraParameters = () => {
  const [camLocationAuto, setCamLocationAuto] = useState(false);
  const [camRotationAuto, setCamRotationAuto] = useState(false);
  const [camLensAuto, setCamLensAuto] = useState(false);

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
              // placeholder="distance from origin [m]"
            />
          </div>
        </div>
        {/*{video ? (*/}
        {/*  <div>*/}
        {/*    <p><strong>Timestamp:</strong> {video.timestamp}</p>*/}
        {/*    /!* Add any other video-specific details *!/*/}
        {/*  </div>*/}
        {/*) : (*/}
        {/*  <p>Loading video details...</p>*/}
        {/*)}*/}
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
              disabled={camLensAuto}

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
              // placeholder="distance from origin [m]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
export default CameraParameters;
