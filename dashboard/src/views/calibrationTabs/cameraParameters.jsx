import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import PropTypes from "prop-types";
import ReactSlider from 'react-slider';
import { useDebouncedWsSender } from "../../api/api.js";
import { getFrameUrl } from "../../utils/images.jsx";
import { projectLine } from "../../utils/computerVision.js";
import { FaCrosshairs, FaLocationArrow } from "react-icons/fa";
import { RiCameraLensFill } from "react-icons/ri";
import { MdModeEdit } from 'react-icons/md';
import { TransformWrapper, TransformComponent, useTransformEffect, useTransformInit } from 'react-zoom-pan-pinch';
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
        <div className="modal-dialog" style={{ maxWidth: "1280px", marginTop: "30px", height: "calc(110vh - 60px)", display: "flex", flexDirection: "column" }}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
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
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, padding: 0 }}>
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



// Image overlay component - must be inside TransformWrapper
const ImageOverlay = ({
  imageUrl,
  imageError,
  drawingMode,
  imageSize,
  setImageSize,
  customLines,
  currentDrawingPoints,
  imgRef,
  handleImageClick,
  transformState,
  setTransformState,
  setImageBbox,
  cameraConfig
}) => {
  // Handle zoom and pan state changes
  useTransformEffect(({ state }) => {
    const imgElement = imgRef.current;
    if (!imgElement) return;
    setImageBbox(imgElement.getBoundingClientRect());
    setTransformState(state);
  });

  useTransformInit(({ state }) => {
    setTransformState(state);
    const handleResize = () => {
      const imgElement = imgRef.current;
      if (!imgElement) return;
      setImageBbox(imgElement.getBoundingClientRect());
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [imgRef, setTransformState, setImageBbox]);

  // Pre-calculate SVG elements (expensive distortion calculations)
  // Only recalculate when imageSize, customLines, or cameraConfig changes
  const { gridLines, customLinesData } = useMemo(() => {
    const img = imgRef.current;
    if (!img || !imageSize?.width) return { gridLines: [], customLinesData: [] };

    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    const { width: natWidth, height: natHeight } = imageSize;
    const scaleX = displayWidth / natWidth;
    const scaleY = displayHeight / natHeight;

    const cameraMatrix = cameraConfig?.data?.camera_matrix;
    const baseCoeffs = cameraConfig?.data?.dist_coeffs || [0, 0, 0, 0, 0, 0, 0, 0];

    let gridLines = [];
    if (cameraMatrix && baseCoeffs) {
      const X = [0.25 * natWidth, 0.5 * natWidth, 0.75 * natWidth];
      const Y = [0.25 * natHeight, 0.5 * natHeight, 0.75 * natHeight];
      let lines = [];
      X.forEach(x => {
        lines.push([[x, 0], [x, natHeight]]);
      });
      Y.forEach(y => {
        lines.push([[0, y], [natWidth, y]]);
      });

      const linesDistort = lines.map((line) => projectLine(line[0], line[1], cameraMatrix, baseCoeffs));
      gridLines = linesDistort.map(line =>
        line.map(point => ({ x: point[0] * scaleX, y: point[1] * scaleY }))
      );
    }

    let customLinesData = [];
    if (cameraMatrix && baseCoeffs) {
      customLinesData = customLines.map(line => ({
        straight: line.map(p => ({ x: p[0] * scaleX, y: p[1] * scaleY })),
        distorted: projectLine(line[0], line[1], cameraMatrix, baseCoeffs)
          .map(p => ({ x: p[0] * scaleX, y: p[1] * scaleY })),
        endpoints: line.map(p => ({ x: p[0] * scaleX, y: p[1] * scaleY }))
      }));
    }

    return { gridLines, customLinesData };
  }, [imageSize, customLines, cameraConfig]);

  // Calculate display-space coordinates for current drawing points (cheap operation)
  const pointsData = useMemo(() => {
    const img = imgRef.current;
    if (!img || !imageSize?.width) return [];

    const displayWidth = img.clientWidth;
    const displayHeight = img.clientHeight;
    const { width: natWidth, height: natHeight } = imageSize;
    const scaleX = displayWidth / natWidth;
    const scaleY = displayHeight / natHeight;

    return currentDrawingPoints.map(p => ({
      x: p[0] * scaleX,
      y: p[1] * scaleY
    }));
  }, [currentDrawingPoints, imageSize]);

  const scale = transformState?.scale || 1;

  return (
    <>
      <div style={{ position: "relative", display: "inline-block", width: "100%" }} onClick={handleImageClick}>
        <img
          ref={imgRef}
          src={imageUrl}
          width="100%"
          style={{
            cursor: drawingMode ? 'crosshair' : 'default',
            userSelect: 'none'
          }}
          onLoad={(e) => {
            const { naturalWidth, naturalHeight } = e.target;
            setImageSize({ width: naturalWidth, height: naturalHeight });
          }}
          alt="Frame preview"
        />
        {/* SVG Overlay */}
        <svg
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
            zIndex: 10
          }}
        >
          {/* Grid lines */}
          {gridLines.map((line, i) => (
            <polyline
              key={`grid-${i}`}
              points={line.map(p => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="white"
              strokeWidth={2 / scale}
            />
          ))}

          {/* Custom lines */}
          {customLinesData.map((lineData, i) => (
            <g key={`custom-${i}`}>
              {/* Dashed straight line */}
              <polyline
                points={lineData.straight.map(p => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#00d4ff"
                strokeWidth={2 / scale}
                strokeDasharray={`${2 / scale},${2 / scale}`}
              />
              {/* Solid distorted line */}
              <polyline
                points={lineData.distorted.map(p => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="#00d4ff"
                strokeWidth={2 / scale}
              />
              {/* Endpoints */}
              {lineData.endpoints.map((p, j) => (
                <circle
                  key={`endpoint-${i}-${j}`}
                  cx={p.x}
                  cy={p.y}
                  r={6 / scale}
                  fill="#00d4ff"
                />
              ))}
            </g>
          ))}

          {/* Current drawing points */}
          {pointsData.map((p, i) => (
            <circle
              key={`point-${i}`}
              cx={p.x}
              cy={p.y}
              r={6 / scale}
              fill="rgba(255, 100, 100, 0.6)"
            />
          ))}
        </svg>
      </div>
    </>
  );
};

const CameraParameters = ({ cameraConfig, setCameraConfig, selectedVideo, ws, drawingMode, customLines, setCustomLines, distortionLocked, setDistortionLocked }) => {
  const [camLocationAuto, setCamLocationAuto] = useState(false);
  const [camRotationAuto, setCamRotationAuto] = useState(false);
  const [camLensAuto, setCamLensAuto] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [imageError, setImageError] = useState(false);  // tracks errors in finding image in modal display
  const [currentDrawingPoints, setCurrentDrawingPoints] = useState([]);
  const [transformState, setTransformState] = useState(null);  // zoom/pan state
  const [imageBbox, setImageBbox] = useState(null);  // bounding box of displayed image
  const [overlayVisible, setOverlayVisible] = useState(true);  // toggle for showing parameter overlay
  const [isLoading, setIsLoading] = useState(true);  // loading state for camera config data

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
  const cameraMatrix = cameraConfig?.data?.camera_matrix || null;
  const distCoeffs = cameraConfig?.data?.dist_coeffs || null;

  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

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
    console.log("COEFFS:", coeffs);
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
      // Only set loading to false when we have the camera matrix and distortion coefficients
      if (cameraConfig?.data?.camera_matrix && cameraConfig?.data?.dist_coeffs) {
        setIsLoading(false);
      }
    } else {
      setFormData({
        camX: '',
        camY: '',
        camZ: '',
        camYaw: '',
        camPitch: '',
        camRoll: '',
        camF: '',
        camK1: 0,
        camK2: 0
      })
    }

    setImageUrl(getFrameUrl(selectedVideo, 0, cameraConfig.rotation))
  }, [cameraConfig]);

  const updateCamConfig = async (updatedFields) => {
    setCameraConfig({
      ...cameraConfig,
      ...updatedFields
    });
    const videoPatch = { video_config: { camera_config: updatedFields } };
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
    const updatedFields = { camera_rotation: newRotation }
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
    const updatedFields = { camera_position: newPosition }
    updateCamConfig(updatedFields)
  }

  const updateLensPars = async (event) => {
    const { name, value } = event.target;
    const fieldName = name.replace(/^cam/, '').toLowerCase();
    const parsedValue = parseFloat(value);
    const updatedFields = { [fieldName]: parsedValue };
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
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    // Normalize to 0-1 range of the displayed image
    const normalizedX = clickX / rect.width;
    const normalizedY = clickY / rect.height;

    // Convert to natural image coordinates
    const naturalX = normalizedX * img.naturalWidth;
    const naturalY = normalizedY * img.naturalHeight;

    const newPoints = [...currentDrawingPoints, [naturalX, naturalY]];
    setCurrentDrawingPoints(newPoints);

    if (newPoints.length === 2) {
      // Add completed line to custom lines
      setCustomLines([...customLines, newPoints]);
      setCurrentDrawingPoints([]);
      // Turn off drawing mode after completing a line
      // This will be handled by parent component when it receives the update
    }
  }



  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Fixed header text section */}
      <div style={{ flex: "0 0 auto", padding: "12px", backgroundColor: "#fff", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>

            <label style={{ fontWeight: "bold" }}>Video frame:</label>
            {isLoading ? (
              <div className="text-sm font-medium">Loading camera configuration...</div>
            ) : cameraMatrix && distCoeffs ? (
              <div className="text-sm font-medium">The horizontal and vertical lines show the impact of lens distortion on straight lines</div>
            ) : (
              <div className="text-sm font-medium">Camera matrix or distortion coefficients are missing.</div>
            )}
            {drawingMode && <div className="text-medium font-bold" style={{ color: "#00d4ff", display: "block" }}>Click on the image to draw two points that form a straight line in the real world. Check if the distorted lines follow the line in the camera view.</div>}
            {customLines.length > 0 && <div className="text-medium font-bold" style={{ color: "#00d4ff", display: "block" }}>{customLines.length} custom line(s) drawn. </div>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              id="distortionLockCheckbox"
              checked={overlayVisible}
              onChange={(e) => setOverlayVisible(e.target.checked)}
              style={{ cursor: "pointer", width: "18px", height: "18px" }}
            />
            <label htmlFor="distortionLockCheckbox" style={{ cursor: "pointer", margin: "0", fontSize: "13px", fontWeight: "500" }}>
              Show parameter overlay
            </label>
          </div>
        </div>
      </div>

      {/* Scrollable image section */}
      <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "auto", minHeight: 0 }}>
        <div className="flex-container no-padding">
          <div className="mb-2 mt-2">
            <div className="readonly" style={{ position: 'relative' }}>
              {imageError ? (
                <div>-</div>
              ) : (
                <>
                  <TransformWrapper>
                    <TransformComponent>
                      <ImageOverlay
                        imageUrl={imageUrl}
                        imageError={imageError}
                        drawingMode={drawingMode}
                        imageSize={imageSize}
                        setImageSize={setImageSize}
                        customLines={customLines}
                        currentDrawingPoints={currentDrawingPoints}
                        imgRef={imgRef}
                        handleImageClick={handleImageClick}
                        transformState={transformState}
                        setTransformState={setTransformState}
                        setImageBbox={setImageBbox}
                        cameraConfig={cameraConfig}
                      />
                    </TransformComponent>
                  </TransformWrapper>
                  {/* Parameter overlay - outside TransformWrapper for fixed positioning */}
                  {overlayVisible && (
                    <div
                      style={{
                        position: "absolute",
                        top: "5px",
                        left: "5px",
                        backgroundColor: "rgba(0, 0, 0, 0.7)",
                        color: "#fff",
                        padding: "10px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        maxWidth: "300px",
                        pointerEvents: "none",
                        zIndex: 100,
                        lineHeight: "1.4"
                      }}
                    >
                      <div style={{ fontWeight: "bold", marginBottom: "5px" }}>Camera Parameters</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <FaCrosshairs />
                        <div><strong>X:</strong> {Number.isFinite(formData.camX) ? parseFloat(formData.camX).toFixed(3) : formData.camX}</div>
                        <div><strong>Y:</strong> {Number.isFinite(formData.camY) ? parseFloat(formData.camY).toFixed(3) : formData.camY}</div>
                        <div><strong>Z:</strong> {Number.isFinite(formData.camZ) ? parseFloat(formData.camZ).toFixed(3) : formData.camZ}</div>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <FaLocationArrow />
                        <div><strong>y:</strong> {Number.isFinite(formData.camYaw) ? parseFloat(formData.camYaw).toFixed(3) : formData.camYaw}</div>
                        <div><strong>p:</strong> {Number.isFinite(formData.camPitch) ? parseFloat(formData.camPitch).toFixed(3) : formData.camPitch}</div>
                        <div><strong>r:</strong> {Number.isFinite(formData.camRoll) ? parseFloat(formData.camRoll).toFixed(3) : formData.camRoll}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <RiCameraLensFill />
                        <div><strong>f:</strong> {Number.isFinite(formData.camF) ? parseFloat(formData.camF).toFixed(3) : formData.camF}</div>
                        <div><strong>k1:</strong> {Number.isFinite(formData.camK1) ? parseFloat(formData.camK1).toFixed(4) : formData.camK1}</div>
                        <div><strong>k2:</strong> {Number.isFinite(formData.camK2) ? parseFloat(formData.camK2).toFixed(4) : formData.camK2}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed lens distortion sliders section at bottom */}
      <div style={{ flex: "0 0 auto", borderTop: "1px solid #ddd", padding: "12px", overflow: "hidden", textAlign: "left" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <label style={{ fontWeight: "bold" }}>Lens distortion sliders</label>
              <div className="text-sm font-medium">
                {cameraMatrix && distCoeffs ? (
                  <span>Adjust k1 and k2 to bend the guide lines interactively. Use scroll or pinch to zoom.</span>
                ) : (
                  <span>Constrain the camera matrix and distortion coefficients using GCPs first. Then come back here to refine them.</span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="distortionLockCheckbox"
                checked={!distortionLocked}
                disabled={!cameraMatrix || !distCoeffs}
                onChange={(e) => setDistortionLocked(!e.target.checked)}
                style={{ cursor: (!cameraMatrix || !distCoeffs) ? "not-allowed" : "pointer", width: "18px", height: "18px" }}
              />
              <label htmlFor="distortionLockCheckbox" style={{ cursor: "pointer", margin: "0", fontSize: "13px", fontWeight: "500" }}>
                Manual adjustment
              </label>
            </div>
          </div>
          <div className="mb-2" style={{ opacity: distortionLocked ? 0.5 : 1, pointerEvents: distortionLocked ? "none" : "auto" }}>
            <label className="form-label" style={{ fontWeight: "bold", marginBottom: "4px" }}>k1</label>
            <div className="slider-container" style={{ width: "100%" }}>
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
          <div className="mb-2" style={{ opacity: distortionLocked ? 0.5 : 1, pointerEvents: distortionLocked ? "none" : "auto" }}>
            <label className="form-label" style={{ fontWeight: "bold", marginBottom: "4px" }}>k2</label>
            <div className="slider-container" style={{ width: "100%" }}>
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

      {/* Other camera parameters section - hidden for now to keep focus on image/sliders */}
      {false && (
        <div className={"flex-container row no-padding"} style={{ flexDirection: "row", justifyContent: "start", textAlign: "left" }}>
          <div className="mb-2 mt-2">
            <label style={{ minWidth: "200px", fontWeight: "bold" }}>
              Camera location:
            </label>
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{ width: '40px' }}>
              x:
            </label>
            <input
              type="text"
              className="form-control"
              id="camX"
              disabled={!camLocationAuto}
              onChange={(e) => updateCameraPosition(0, parseFloat(e.target.value))}
              value={formData.camX}
            />
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{ width: '40px' }}>
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
            <label className="input-group-text" style={{ width: '40px' }}>
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
            <label style={{ minWidth: "200px", fontWeight: "bold" }}>
              Camera rotation:
            </label>
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{ width: '60px' }}>
              yaw:
            </label>
            <input
              type="text"
              className="form-control"
              id="camYaw"
              disabled={!camRotationAuto}
              onChange={(e) => updateCameraRotation(0, parseFloat(e.target.value))}
              value={formData.camYaw}
            />
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{ width: '60px' }}>
              pitch:
            </label>
            <input
              type="text"
              className="form-control"
              id="camPitch"
              disabled={!camRotationAuto}
              onChange={(e) => updateCameraRotation(1, parseFloat(e.target.value))}
              value={formData.camPitch}
            />
          </div>
          <div className="input-group mb-2">
            <label className="input-group-text" style={{ width: '60px' }}>
              roll:
            </label>
            <input
              type="text"
              className="form-control"
              id="camRoll"
              disabled={!camRotationAuto}
              onChange={(e) => updateCameraRotation(2, parseFloat(e.target.value))}
              value={formData.camRoll}
            />
          </div>
          <div className="mb-2 mt-2">
            <label style={{ minWidth: "200px", fontWeight: "bold" }}>
              Lens parameters:
            </label>
          </div>

          <div className="input-group mb-2">
            <label className="input-group-text" style={{ width: '60px' }}>
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
            <label className="input-group-text" style={{ width: '60px' }}>
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
            <label className="input-group-text" style={{ width: '60px' }}>
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
        </div>
      )}
    </div>
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

ImageOverlay.propTypes = {
  imageUrl: PropTypes.string,
  imageError: PropTypes.bool,
  drawingMode: PropTypes.bool.isRequired,
  imageSize: PropTypes.object.isRequired,
  setImageSize: PropTypes.func.isRequired,
  customLines: PropTypes.array.isRequired,
  currentDrawingPoints: PropTypes.array.isRequired,
  imgRef: PropTypes.object.isRequired,
  handleImageClick: PropTypes.func.isRequired,
  transformState: PropTypes.object,
  setTransformState: PropTypes.func.isRequired,
  setImageBbox: PropTypes.func.isRequired,
  cameraConfig: PropTypes.object,
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
