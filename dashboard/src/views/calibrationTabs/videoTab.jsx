import { useState, useRef, useEffect } from 'react';
import { TransformWrapper } from 'react-zoom-pan-pinch';
import PhotoComponent from './photoComponent';
import ControlPanel from './controlPanel';
import PropTypes from 'prop-types';
import {useMessage} from "../../messageContext.jsx";
import { useInteractiveFrameStream } from "../../utils/images.jsx";

const VideoTab = (
  {
    video,
    frameNr,
    cameraConfig,
    widgets,
    selectedWidgetId,
    updateWidget,
    imgDims,
    rotate,
    CSDischarge,
    CSWaterLevel,
    bboxSelected,
    setCameraConfig,
    setSelectedWidgetId,
    setImgDims,
    setBboxSelected,
    handleBboxStart,
    ws
  }
) => {
  const [dragging, setDragging] = useState(false);
  const [scale, setScale] = useState(1);
  const [bboxMarkers, setBboxMarkers] = useState([]);
  const [clickCount, setClickCount] = useState(0);
  const imageRef = useRef(null);  // Reference to image within TransFormWrapper
  const [bBoxPolygon, setBBoxPolygon] = useState(null);
  const [wettedBbox, setWettedBbox] = useState([]);  // wetted part of bounding box, following CS
  const {setMessageInfo} = useMessage();

  const {
    current_frame,
    total_frames,
    is_playing,
    play,
    pause,
    stop,
    seek,
    forward,
    rewind,
    setRotate,
  } = useInteractiveFrameStream(video?.id);
  const [sliderValue, setSliderValue] = useState(current_frame);

  useEffect(() => {
    setSliderValue(current_frame);
  }, [current_frame]);

  const handleGCPClick = (adjustedX, adjustedY, normalizedX, normalizedY, originalRow, originalCol) => {
    // Add the new dot to the state with the ID of the associated widget
    if (!selectedWidgetId) {
      setMessageInfo('info', 'Please select a widget first');
      return;
    } else {
      updateWidget(selectedWidgetId, {
        ...widgets.find((widget) => widget.id === selectedWidgetId).coordinates,
        row: originalRow,
        col: originalCol,
      });

      // Select next widget
      const nextWidgetId = getNextWidgetId(selectedWidgetId);
      setSelectedWidgetId(nextWidgetId);
    }
  }

  const handleBoundingBoxClick = (adjustedX, adjustedY, normalizedX, normalizedY, originalRow, originalCol) => {
    if (clickCount >= 3) return;
    console.log("Adding marker", adjustedX, adjustedY);
    const newMarkers = [...bboxMarkers, {x: adjustedX, y: adjustedY, col: originalCol, row: originalRow}];
    setBboxMarkers(newMarkers);
    setClickCount(clickCount + 1);
    if (clickCount === 2) {
      // Draw final marker and reset after 2 seconds
      setTimeout(() => {
        setBboxSelected(false);
        setBboxMarkers([]);
        setClickCount(0);
      }, 2000);
    }
  };

  const getNextWidgetId = (currentId) => {
    const currentIndex = widgets.findIndex(widget => widget.id === currentId);
    return widgets[(currentIndex + 1) % widgets.length].id;
  };


  return (
    <div style={{ height: '100%', maxHeight: '100%', width: '100%', maxWidth: '100%', overflow: 'auto', position: 'relative'}}>
      {cameraConfig && (
        <ControlPanel
          onBoundingBox={handleBboxStart}
          cameraConfig={cameraConfig}
          bboxSelected={bboxSelected}
          ws={ws}
        />
      )
      }
      <div style={{position: 'sticky', textAlign: 'center', marginBottom: '10px', color: '#555' }}>
        {bboxSelected ? (
          "First click left bank, then right bank, then expand up and downstream"
        ) : (
          "Zoom and pan with your mouse. Click on the photo to select row/column"
        )
        }
      </div>

      <div className="frame-controls" style={{
        padding: '1rem',
        display: 'flex',
        gap: '0.5rem',
        alignItems: 'center',
        backgroundColor: '#f5f5f5',
        borderTop: '1px solid #ddd'
      }}>
        {/* Frame Slider */}
        <div style={{ flex: 1 }}>
          <input
            type="range"
            min="0"
            max={total_frames - 1}
            value={sliderValue}
            onChange={(e) => setSliderValue(parseInt(e.target.value))}
            onMouseUp={(e) => {
              console.log("Mouse up detected")
              console.log("Seeking to frame:", parseInt(e.target.value))
              seek(parseInt(e.target.value))
            }}
            onTouchEnd={(e) => {
              seek(parseInt(e.target.value))
            }}
            style={{ width: '100%' }}
          />
          <div style={{ fontSize: '0.85rem', color: '#666' }}>
            Frame {current_frame + 1} / {total_frames}
          </div>
        </div>

        {/* Control Buttons */}
        <button onClick={rewind} style={{ padding: '0.5rem 1rem' }}>
          ⏮
        </button>
        <button
          onClick={play}
          disabled={is_playing}
          style={{ padding: '0.5rem 1rem', opacity: is_playing ? 0.5 : 1 }}
        >
          ▶
        </button>
        <button
          onClick={pause}
          disabled={!is_playing}
          style={{ padding: '0.5rem 1rem', opacity: !is_playing ? 0.5 : 1 }}
        >
          ⏸        </button>
        <button onClick={forward} style={{ padding: '0.5rem 1rem' }}>
          ⏭
        </button>
      </div>

      <TransformWrapper
        pinchEnabled={true}
        wheelEnabled={false}
        touchEnabled={true}
        panEnabled={true}
        preventWheel={true}
        // ensure the scale is tracked all the time
        onTransformed={(e) => {
          setScale(e.state.scale)
        }}
      >
        <PhotoComponent
          video={video}
          frameNr={frameNr}
          imageRef={imageRef}
          widgets={widgets}
          cameraConfig={cameraConfig}
          scale={scale}
          imgDims={imgDims}
          rotate={rotate}
          bBoxPolygon={bBoxPolygon}
          wettedBbox={wettedBbox}
          CSDischarge={CSDischarge}
          CSWaterLevel={CSWaterLevel}
          dragging={dragging}
          setCameraConfig={setCameraConfig}
          setImgDims={setImgDims}
          setBBoxPolygon={setBBoxPolygon}
          setWettedBbox={setWettedBbox}
          bboxMarkers={bboxMarkers}
          handlePhotoClick={bboxSelected ? handleBoundingBoxClick : handleGCPClick}
          bboxClickCount={clickCount}
          ws={ws}
        />
      </TransformWrapper>
    </div>
  );
};

VideoTab.propTypes = {
  video: PropTypes.object.isRequired,
  frameNr: PropTypes.number.isRequired,
  cameraConfig: PropTypes.object.isRequired,
  widgets: PropTypes.array.isRequired,
  selectedWidgetId: PropTypes.oneOfType([PropTypes.number]),
  updateWidget: PropTypes.func.isRequired,
  imgDims: PropTypes.object,
  rotate: PropTypes.number,
  CSDischarge: PropTypes.object,
  CSWaterLevel: PropTypes.object,
  bboxSelected: PropTypes.bool.isRequired,
  setCameraConfig: PropTypes.func.isRequired,
  setSelectedWidgetId: PropTypes.func.isRequired,
  setImgDims: PropTypes.func.isRequired,
  setBboxSelected: PropTypes.func.isRequired,
  handleBboxStart: PropTypes.func.isRequired,
  ws: PropTypes.object.isRequired,
};

export default VideoTab;
