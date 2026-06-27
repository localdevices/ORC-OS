import {useEffect, useState, useRef, useCallback} from 'react';
import PropTypes from "prop-types";
import ReactSlider from 'react-slider';
import {useDebouncedWsSender} from "../../api/api.js";
import { getFrameUrl } from "../../utils/images.jsx";
import { projectLine } from "../../utils/computerVision.js";
import { MdModeEdit } from 'react-icons/md';
import '../recipeComponents/recipeComponents.css';

const CameraParametersModal = ({
  setShowModal,
  cameraConfig,
  setCameraConfig,
  customLines,
  setCustomLines,
  distortionLocked,
  setDistortionLocked,
  selectedVideo,
  ws
}) => {
  const [drawingMode, setDrawingMode] = useState(false);
  // const [distortionLocked, setDistortionLocked] = useState(true);

  // When a new line is added, turn off drawing mode
  useEffect(() => {
    if (customLines.length > 0 && drawingMode) {
      setDrawingMode(false);
    }
  }, [customLines]);

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
                className="btn btn-sm"
                style={{
                  background: drawingMode ? 'rgba(0, 157, 211, 0.8)' : 'rgba(108, 117, 125, 0.8)',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  padding: '5px 10px',
                  cursor: 'pointer',
                  marginRight: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'background 0.2s'
                }}
                onClick={() => {
                  setDrawingMode(!drawingMode);
                  if (drawingMode) {
                    setCustomLines([]);
                  }
                }}
                title="Draw custom lines on image"
              >
                <MdModeEdit size={16} />
                {drawingMode ? 'Drawing' : 'Draw Lines'}
              </button>
              {customLines.length > 0 && (
                <button
                  onClick={() => setCustomLines([])}
                  style={{
                    background: 'rgba(220, 53, 69, 0.8)',
                    border: 'none',
                    borderRadius: '4px',
                    color: 'white',
                    padding: '5px 10px',
                    cursor: 'pointer',
                    marginRight: '10px',
                    transition: 'background 0.2s',
                    fontSize: '14px'
                  }}
                  onMouseOver={(e) => e.target.style.background = 'rgba(220, 53, 69, 1)'}
                  onMouseOut={(e) => e.target.style.background = 'rgba(220, 53, 69, 0.8)'}
                  title="Clear all custom lines"
                >
                  Clear Lines ({customLines.length})
                </button>
              )}
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
                drawingMode={drawingMode}
                customLines={customLines}
                setCustomLines={setCustomLines}
                distortionLocked={distortionLocked}
                setDistortionLocked={setDistortionLocked}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const CameraParameters = ({cameraConfig, setCameraConfig, selectedVideo, ws, drawingMode, customLines, setCustomLines, distortionLocked, setDistortionLocked}) => {
  const [camLocationAuto, setCamLocationAuto] = useState(false);
  const [camRotationAuto, setCamRotationAuto] = useState(false);
  const [camLensAuto, setCamLensAuto] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageError, setImageError] = useState(false);  // tracks errors in finding image in modal display
  const [currentDrawingPoints, setCurrentDrawingPoints] = useState([]);

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

  const resolveLensValue = (value, fallback, defaultValue = 0) => {
    const parsedValue = parseFloat(value);
    if (Number.isFinite(parsedValue)) return parsedValue;
    if (Number.isFinite(fallback)) return fallback;
    return Number.isFinite(defaultValue) ? defaultValue : 0;
  };

  // Constrain k2 based on k1 to ensure realistic combinations
  // Rule: |k2| should not exceed 3x |k1|, and they should generally have the same sign
  const constrainK2 = (k1Value, k2Value) => {
    const maxK2Magnitude = Math.abs(k1Value) * 3;
    if (Math.abs(k2Value) > maxK2Magnitude) {
      // Constrain k2 to the maximum allowed magnitude, keeping sign
      return Math.sign(k2Value) * maxK2Magnitude;
    }
    return k2Value;
  };

  // Constrain k1 based on k2 to ensure realistic combinations
  const constrainK1 = (k1Value, k2Value) => {
    const minK1Magnitude = Math.abs(k2Value) / 3;
    if (Math.abs(k1Value) < minK1Magnitude && Math.abs(k2Value) > 0) {
      // Ensure k1 is large enough to support k2
      return Math.sign(k1Value || 1) * minK1Magnitude;
    }
    return k1Value;
  };

  const getActiveDistCoeffs = useCallback(() => {
    const baseCoeffs = cameraConfig?.data?.dist_coeffs || [0, 0, 0, 0, 0, 0, 0, 0];
    const coeffs = [...baseCoeffs];
    coeffs[0] = resolveLensValue(formData.camK1, cameraConfig?.k1, coeffs[0]);
    coeffs[1] = resolveLensValue(formData.camK2, cameraConfig?.k2, coeffs[1]);
    return coeffs;
  }, [cameraConfig, formData.camK1, formData.camK2]);

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

  const handleLensSliderChange = async (name, value) => {
    // Unlock distortion controls when user starts adjusting
    if (distortionLocked) {
      setDistortionLocked(false);
    }

    let updatedK1 = name === 'camK1' ? value : resolveLensValue(formData.camK1, cameraConfig?.k1, 0);
    let updatedK2 = name === 'camK2' ? value : resolveLensValue(formData.camK2, cameraConfig?.k2, 0);

    // Apply constraints based on which parameter is being adjusted
    if (name === 'camK1') {
      updatedK2 = constrainK2(updatedK1, updatedK2);
    } else {
      updatedK1 = constrainK1(updatedK1, updatedK2);
    }

    setFormData(prev => ({
      ...prev,
      camK1: updatedK1,
      camK2: updatedK2
    }));

    await updateCamConfig({
      k1: updatedK1,
      k2: updatedK2
    });
  }

  const handleImageClick = (event) => {
    if (!drawingMode) return;

    const img = imgRef.current;
    if (!img) return;

    const rect = img.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Normalize to image coordinates
    const normalizedX = (x / rect.width) * img.naturalWidth;
    const normalizedY = (y / rect.height) * img.naturalHeight;

    const newPoints = [...currentDrawingPoints, [normalizedX, normalizedY]];
    setCurrentDrawingPoints(newPoints);

    if (newPoints.length === 2) {
      // Add completed line to custom lines
      setCustomLines([...customLines, newPoints]);
      setCurrentDrawingPoints([]);
      // Turn off drawing mode after completing a line
      // This will be handled by parent component when it receives the update
    }
  }

  const drawDistortionOverlay = useCallback(() => {
    const distCoeffs = getActiveDistCoeffs();
    const cameraMatrix = cameraConfig?.data?.camera_matrix;
    if (!cameraMatrix || !distCoeffs) {
      return;
    }
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    if (!imageSize.width || !imageSize.height) return;

    const {width, height} = imageSize;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.zIndex = 1e31;

    // Normalize so that the image center is (0,0) and the shorter side is in [-1,1]
    const drawLine = (line, color = 'white', thickness = 2, dashed = false) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      if (dashed) {
        ctx.setLineDash([5, 5]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.beginPath();
      line.map((d, i) => {
        if (i === 0) {
          ctx.moveTo(d[0], d[1]);
        } else {
          ctx.lineTo(d[0], d[1]);
        }
      })
      ctx.stroke();
      ctx.setLineDash([]);
    };

    // Draw grid lines
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
    linesDistort.forEach((line) => {
      drawLine(line, 'white', 4);
    })

    // Draw custom lines with distortion
    customLines.forEach((line) => {
      // Draw straight line as thin dashed
      drawLine(line, '#00d4ff', 6, true);
      // Draw distorted line as thicker
      const distortedLine = projectLine(line[0], line[1], cameraMatrix, distCoeffs);
      drawLine(distortedLine, '#00d4ff', 6);
      // Draw endpoint dots
      ctx.fillStyle = '#00d4ff';
      line.forEach(point => {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 16, 0, 2 * Math.PI);
        ctx.fill();
      });
    });

    // Draw current drawing in progress
    if (currentDrawingPoints.length > 0) {
      ctx.fillStyle = 'rgba(255, 100, 100, 0.6)';
      currentDrawingPoints.forEach(point => {
        ctx.beginPath();
        ctx.arc(point[0], point[1], 12, 0, 2 * Math.PI);
        ctx.fill();
      });
    }
  }, [cameraConfig, customLines, currentDrawingPoints, getActiveDistCoeffs, imageSize]);

  // Ensure image dimensions are captured when component mounts or image ref changes
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
      // Image is already loaded (cached), set dimensions manually
      setImageSize({width: img.naturalWidth, height: img.naturalHeight});
    }
  }, []);

  // Ensure canvas redraws when component mounts with existing customLines
  useEffect(() => {
    if (imageSize.width > 0 && imageSize.height > 0 && customLines.length > 0) {
      drawDistortionOverlay();
    }
  }, []);

  useEffect(() => {
    drawDistortionOverlay();
  }, [drawDistortionOverlay, imageSize, customLines, currentDrawingPoints]);

  return (
    <div>
      <div className="flex-container no-padding" style={{overflow: "auto"}}>
        <div className="mb-2 mt-2">
          <label style={{minWidth: "800px", fontWeight: "bold"}}>Video frame:</label>
          <div className="text-sm font-medium">The horizontal and vertical lines show the impact of lens distortion on straight lines</div>
          {drawingMode && <div className="text-medium font-bold" style={{color: "#00d4ff", display: "block"}}>Click on the image to draw two points that form a straight line in the real world. Check if the distorted lines follow the line in the camera view.</div>}
          {customLines.length > 0 && <div className="text-medium font-bold" style={{color: "#00d4ff", display: "block"}}>{customLines.length} custom line(s) drawn. </div>}
          <div className="readonly">
            {imageError ? (
              <div>-</div>
            ) : (
              <div style={{position: "relative", display: "inline-block", width: "90%"}}>
              <img
                ref={imgRef}
                src={imageUrl}
                width="100%"
                onClick={handleImageClick}
                style={{
                  cursor: drawingMode ? 'crosshair' : 'default',
                  userSelect: 'none'
                }}
                onLoad={(e) => {
                  if (imageError) setImageError(false);
                  const {naturalWidth, naturalHeight} = e.target;
                  // console.log("naturalWidth, naturalHeight:", naturalWidth, naturalHeight);
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
          <div style={{width: "90%", marginTop: "12px", display: "flex", flexDirection: "column", gap: "10px"}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}>
              <div>
                <label style={{fontWeight: "bold"}}>Lens distortion sliders</label>
                <div className="text-sm font-medium">
                  Adjust k1 and k2 to bend the guide lines interactively.
                </div>
              </div>
              <div style={{display: "flex", alignItems: "center", gap: "8px"}}>
                <input
                  type="checkbox"
                  id="distortionLockCheckbox"
                  checked={!distortionLocked}
                  onChange={(e) => setDistortionLocked(!e.target.checked)}
                  style={{cursor: "pointer", width: "18px", height: "18px"}}
                />
                <label htmlFor="distortionLockCheckbox" style={{cursor: "pointer", margin: "0", fontSize: "13px", fontWeight: "500"}}>
                  Manual adjustment
                </label>
              </div>
            </div>
            <div className="mb-2" style={{opacity: distortionLocked ? 0.5 : 1, pointerEvents: distortionLocked ? "none" : "auto"}}>
              <label className="form-label" style={{fontWeight: "bold", marginBottom: "4px"}}>k1</label>
              <div className="slider-container" style={{width: "100%"}}>
                <div className="slider-min">-0.5</div>
                <div className="slider-max">0.5</div>
                <ReactSlider
                  className="horizontal-slider"
                  thumbClassName="thumb"
                  trackClassName="track"
                  value={Number.isFinite(parseFloat(formData.camK1)) ? parseFloat(formData.camK1) : 0}
                  min={-0.5}
                  max={0.5}
                  step={0.001}
                  disabled={distortionLocked}
                  renderThumb={(props, state) => (
                    <div {...props}>
                      <div className="thumb-value">{state.valueNow.toFixed(3)}</div>
                    </div>
                  )}
                  onChange={(value) => handleLensSliderChange("camK1", value)}
                />
              </div>
            </div>
            <div className="mb-2" style={{opacity: distortionLocked ? 0.5 : 1, pointerEvents: distortionLocked ? "none" : "auto"}}>
              <label className="form-label" style={{fontWeight: "bold", marginBottom: "4px"}}>k2</label>
              <div className="slider-container" style={{width: "100%"}}>
                <div className="slider-min">-0.5</div>
                <div className="slider-max">0.5</div>
                <ReactSlider
                  className="horizontal-slider"
                  thumbClassName="thumb"
                  trackClassName="track"
                  value={Number.isFinite(parseFloat(formData.camK2)) ? parseFloat(formData.camK2) : 0}
                  min={-0.5}
                  max={0.5}
                  step={0.001}
                  disabled={distortionLocked}
                  renderThumb={(props, state) => (
                    <div {...props}>
                      <div className="thumb-value">{state.valueNow.toFixed(3)}</div>
                    </div>
                  )}
                  onChange={(value) => handleLensSliderChange("camK2", value)}
                />
              </div>
            </div>
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
  drawingMode: PropTypes.bool.isRequired,
  customLines: PropTypes.array.isRequired,
  setCustomLines: PropTypes.func.isRequired,
  distortionLocked: PropTypes.bool.isRequired,
  setDistortionLocked: PropTypes.func.isRequired,
};

CameraParametersModal.propTypes = {
  cameraConfig: PropTypes.object.isRequired,
  setCameraConfig: PropTypes.func.isRequired,
  setShowModal: PropTypes.func.isRequired,
  selectedVideo: PropTypes.object.isRequired,
  ws: PropTypes.object,
  distortionLocked: PropTypes.bool.isRequired,
  setDistortionLocked: PropTypes.func.isRequired,
};

// export default CameraParameters;

export default CameraParametersModal;
