import {useEffect, useState, useRef, useCallback} from 'react';
import PropTypes from "prop-types";
import {useDebouncedWsSender} from "../../api/api.js";
import { getFrameUrl } from "../../utils/images.jsx";
import { projectLine } from "../../utils/computerVision.js"

const CameraParametersModal = ({setShowModal, cameraConfig, setCameraConfig, selectedVideo, ws}) => {
  return (
    <>
      <div className="sidebar-overlay"></div> {/*make background grey*/}
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "1280px", marginTop: "30px"}}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">{`Camera parameters`}</h5>
              <button
                type="button"
                className="btn-close"
                onClick={() => setShowModal(false)}
              ></button>
            </div>
            <div className="modal-body">
              <CameraParameters
                cameraConfig={cameraConfig}
                setCameraConfig={setCameraConfig}
                selectedVideo={selectedVideo}
                ws={ws}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const CameraParameters = ({cameraConfig, setCameraConfig, selectedVideo, ws}) => {
  const [camLocationAuto, setCamLocationAuto] = useState(false);
  const [camRotationAuto, setCamRotationAuto] = useState(false);
  const [camLensAuto, setCamLensAuto] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageError, setImageError] = useState(false);  // tracks errors in finding image in modal display

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
  // Refs & state for overlay drawing
  const imgRef = useRef(null);
  const canvasRef = useRef(null);
  const [imageSize, setImageSize] = useState({width: 0, height: 0});

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

    setImageUrl(getFrameUrl(selectedVideo, 0, cameraConfig.rotation))
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
    const fieldName = name.replace(/^cam/, '').toLowerCase();
    const parsedValue = parseFloat(value);
    const updatedFields = {[fieldName]: parsedValue};
    await updateCamConfig(updatedFields);
  }

  const drawDistortionOverlay = () => {
    const distCoeffs = cameraConfig.data.dist_coeffs
    const cameraMatrix = cameraConfig.data.camera_matrix
    if (!cameraMatrix || !distCoeffs) {
      return;
    }
    console.log(canvasRef.current?.width, canvasRef.current?.height);
    const canvas = canvasRef.current;
    const img = imgRef.current;
    console.log("IMG:", img);
    console.log("IMAGE SIZE:", imageSize)
    if (!canvas || !img) return;
    if (!imageSize.width || !imageSize.height) return;

    const {width, height} = imageSize;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'white';
    ctx.zIndex = 1e31;

    // Normalize so that the image center is (0,0) and the shorter side is in [-1,1]
    const drawLine = (line) => {
      ctx.beginPath();
      line.map((d, i) => {
        if (i === 0) {
          ctx.moveTo(d[0], d[1]);
        } else {
          ctx.lineTo(d[0], d[1]);
        }
      })
      ctx.stroke();
    };
    const X = [0.25 * width, 0.5 * width, 0.75 * width];
    const Y = [0.25 * height, 0.5 * height, 0.75 * height];
    let lines = [];
    X.map(x => {
      lines.push([[x, 0], [x, height]]);
    })
    Y.map(y => {
      lines.push([[0, y], [width, y]]);
    })
    // make distorted lines
    const linesDistort = lines.map((line) => {
        return projectLine(line[0], line[1], cameraMatrix, distCoeffs);
      }
    )
    console.log(linesDistort);
    linesDistort.forEach((line) => {
      drawLine(line);
    })
  }

  useEffect(() => {

    drawDistortionOverlay();
  }, [drawDistortionOverlay, imageSize, imgRef.current, canvasRef.current]);

  return (
    <div>
      <div className="flex-container no-padding" style={{overflow: "auto"}}>
        <div className="mb-2 mt-2">
          <label style={{minWidth: "800px", fontWeight: "bold"}}>Video frame:</label>
          <i className="text-success">The horizontal and vertical lines show the impact of lens distortion on straight lines</i>
          <div className="readonly">
            {imageError ? (
              <div>-</div>
            ) : (
              <div style={{position: "relative", display: "inline-block", width: "90%"}}>
              <img
                ref={imgRef}
                src={imageUrl}
                width="100%"
                onLoad={(e) => {
                  if (imageError) setImageError(false);
                  const {naturalWidth, naturalHeight} = e.target;
                  console.log("naturalWidth, naturalHeight:", naturalWidth, naturalHeight);
                  setImageSize({width: naturalWidth, height: naturalHeight});
                  // drawDistortionOverlay();
                }}
                onError={() => setImageError(true)}
                alt="Frame preview"
              />
                <canvas
                  ref={canvasRef}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: "100%",
                    height: "100%",
                    pointerEvents: "none"
                  }}
                />
              </div>
            )
            }
          </div>
        </div>
        <div className={"flex-container row no-padding"} style={{flexDirection: "row", justifyContent: "start", textAlign: "left"}}>
          <div className="mb-2 mt-2">
            <label style={{minWidth: "200px", fontWeight: "bold"}}>
              Camera location:
            </label>
          </div>
          {/*<div className="form-check">*/}
          {/*  <label className="form-check-label">*/}
          {/*    <input*/}
          {/*      type="checkbox"*/}
          {/*      className="form-check-input me-2"*/}
          {/*      onChange={(e) => setCamLocationAuto(e.target.checked)}*/}
          {/*      checked={camLocationAuto}*/}
          {/*    />*/}
          {/*    Fix*/}
          {/*  </label>*/}
          {/*</div>*/}
          <div className="input-group mb-2">
            <label className="input-group-text" style={{width: '40px'}}>
              x:
            </label>
            <input
              type="text"
              className="form-control"
              id="camX"
              disabled={!camLocationAuto}
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
                disabled={!camLocationAuto}
                onChange={(e) => updateCameraPosition(1, parseFloat(e.target.value))}
                value={formData.camY}
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
                disabled={!camLocationAuto}
                onChange={(e) => updateCameraPosition(2, parseFloat(e.target.value))}
                value={formData.camZ}
              />
            </div>
            <div className="mb-2 mt-2">
              <label style={{minWidth: "200px", fontWeight: "bold"}}>
                Camera rotation:
              </label>
            </div>
            {/*<div className="form-check">*/}
            {/*<label className="form-check-label">*/}
            {/*  <input*/}
            {/*    type="checkbox"*/}
            {/*    className="form-check-input me-2"*/}
            {/*    onChange={(e) => setCamRotationAuto(e.target.checked)}*/}
            {/*    checked={camRotationAuto}*/}
            {/*  />*/}
            {/*  Fix*/}
            {/*</label>*/}
            {/*</div>*/}
            <div className="input-group mb-2">
              <label className="input-group-text" style={{width: '60px'}}>
                yaw:
              </label>
              <input
                type="text"
                className="form-control"
                id="camYaw"
                disabled={!camRotationAuto}
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
                disabled={!camRotationAuto}
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
                disabled={!camRotationAuto}
                onChange={(e) => updateCameraRotation(2, parseFloat(e.target.value))}
                value={formData.camRoll}
                // placeholder="distance from origin [m]"
              />
            </div>
            <div className="mb-2 mt-2">
              <label style={{minWidth: "200px", fontWeight: "bold"}}>
                Lens parameters:
              </label>
            </div>
            {/*<div className="form-check">*/}
            {/*  <label className="form-check-label">*/}
            {/*    <input*/}
            {/*      type="checkbox"*/}
            {/*      className="form-check-input me-2"*/}
            {/*      onChange={(e) => setCamLensAuto(e.target.checked)}*/}
            {/*      checked={camLensAuto}*/}
            {/*    />*/}
            {/*    Fix*/}
            {/*  </label>*/}
            {/*</div>*/}

            <div className="input-group mb-2">
              <label className="input-group-text" style={{width: '60px'}}>
                f:
              </label>
              <input
                type="text"
                className="form-control"
                id="camF"
                name="camF"
                disabled={!camLensAuto}
                value={formData.camF}
                onChange={updateLensPars}
              />
            </div>
            <div className="input-group mb-2">
              <label className="input-group-text" style={{width: '60px'}}>
                k1:
              </label>
              <input
                type="text"
                className="form-control"
                id="camK1"
                name="camK1"
                disabled={!camLensAuto}
                value={formData.camK1}
                onChange={updateLensPars}
              />
            </div>
            <div className="input-group mb-2">
              <label className="input-group-text" style={{width: '60px'}}>
                k2:
              </label>
              <input
                type="text"
                className="form-control"
                id="camK2"
                name="camK2"
                disabled={!camLensAuto}
                value={formData.camK2}
                onChange={updateLensPars}
              />
            </div>



          {/*</div>*/}

        </div>
      </div>
    </div>
    //     <div className="flex-container column">
    //     <h6>Lens parameters</h6>
    //     </div>
    //   </div>
    // </div>
  )
}
CameraParameters.propTypes = {
  cameraConfig: PropTypes.object.isRequired,
  setCameraConfig: PropTypes.func.isRequired,
};

CameraParametersModal.propTypes = {
  cameraConfig: PropTypes.object.isRequired,
  setCameraConfig: PropTypes.func.isRequired,
};

// export default CameraParameters;

export default CameraParametersModal;
