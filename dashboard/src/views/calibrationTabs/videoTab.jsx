import { useState, useRef } from 'react';
import { TransformWrapper } from 'react-zoom-pan-pinch';
import PhotoComponent from './photoComponent';
import ControlPanel from './controlPanel';
import PropTypes from 'prop-types';
import {useMessage} from "../../messageContext.jsx";

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
    setCameraConfig,
    setSelectedWidgetId,
    setImgDims,
  }
) => {
  const [scale, setScale] = useState(1);
  const [bboxMarkers, setBboxMarkers] = useState([]);
  const [clickCount, setClickCount] = useState(0);
  const [bboxSelected, setBboxSelected] = useState(false);
  const imageRef = useRef(null);  // Reference to image within TransFormWrapper
  const [bBoxPolygon, setBBoxPolygon] = useState(null);
  const {setMessageInfo} = useMessage();

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
      // Draw final marker and reset
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

  const handleRotateLeft = () => {
    console.log('Rotate left');
    // Implement bounding box logic
  };

  const handleRotateRight = () => {
    console.log('Rotate right');
    // Implement bounding box logic
  };

  const handleMove = (direction) => {
    console.log('Move:', direction);
    // Implement move logic
  };

  return (
          <div style={{ height: '100%', maxHeight: '100%', width: '100%', maxWidth: '100%', overflow: 'auto', position: 'relative'}}>
            <ControlPanel
              onRotateLeft={handleRotateLeft}
              onRotateRight={handleRotateRight}
              onBoundingBox={() => {
                setBboxSelected(true);
                setBBoxPolygon(null);
                // remove bbox_camera from cameraConfig
                const newConfig = {
                  ...cameraConfig,
                  bbox_camera: null,
                };

                setCameraConfig(newConfig);
              }}
              onMove={handleMove}
              cameraConfig={cameraConfig}
              bboxSelected={bboxSelected}
            />

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
                   CSDischarge={CSDischarge}
                   CSWaterLevel={CSWaterLevel}
                   setCameraConfig={setCameraConfig}
                   setImgDims={setImgDims}
                   setBBoxPolygon={setBBoxPolygon}
                   bboxMarkers={bboxMarkers}
                   handlePhotoClick={bboxSelected ? handleBoundingBoxClick : handleGCPClick}
                   bboxClickCount={clickCount}
                 />
            </TransformWrapper>
            <div style={{position: 'sticky', textAlign: 'center', marginTop: '10px', color: '#555' }}>
              Zoom and pan with your mouse. Click on the photo to select row/column
            </div>
{/*       <h2>Current Coordinates:</h2> */}
{/*       <pre>{JSON.stringify(widgets, null, 2)}</pre> */}
    </div>
  );
};

VideoTab.propTypes = {
  video: PropTypes.object.isRequired,
  widgets: PropTypes.array.isRequired,
  selectedWidgetId: PropTypes.oneOfType([PropTypes.number]),
  updateWidget: PropTypes.func.isRequired,
  imgDims: PropTypes.object,
  setImgDims: PropTypes.func.isRequired,
};

export default VideoTab;
