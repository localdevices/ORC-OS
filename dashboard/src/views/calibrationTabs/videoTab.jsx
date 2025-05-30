import { useState, useRef } from 'react';
import { TransformWrapper } from 'react-zoom-pan-pinch';
import PhotoComponent from './photoComponent';
import ControlPanel from './controlPanel';
import PropTypes from 'prop-types';
import {useMessage} from "../../messageContext.jsx";

const VideoTab = (
  {
    video,
    cameraConfig,
    widgets,
    selectedWidgetId,
    updateWidget,
    dots,
    imgDims,
    rotate,
    setSelectedWidgetId,
    setDots,
    setImgDims,
  }
) => {
  const [scale, setScale] = useState(1);
  const [bboxMarkers, setBboxMarkers] = useState([]);
  const [clickCount, setClickCount] = useState(0);
  const [bboxSelected, setBboxSelected] = useState(false);
  const imageRef = useRef(null);  // Reference to image within TransFormWrapper

  const {setMessageInfo} = useMessage();

  const handleGCPClick = (adjustedX, adjustedY, normalizedX, normalizedY, originalRow, originalCol) => {
    // Add the new dot to the state with the ID of the associated widget
    if (!selectedWidgetId) {
      setMessageInfo('info', 'Please select a widget first');
      return;
    } else {

      // Update the dots
      setDots((prevDots) => ({
        ...prevDots,
        [selectedWidgetId]: {
          x: adjustedX,
          y: adjustedY,
          xNorm: normalizedX,
          yNorm: normalizedY,
          scale: scale,
          color: getWidgetById(selectedWidgetId).color
        },
      }));

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
    const newMarkers = [...bboxMarkers, {x: adjustedX, y: adjustedY}];
    setBboxMarkers(newMarkers);
    setClickCount(clickCount + 1);

    if (clickCount === 2) {
      // Draw final marker and reset
      setTimeout(() => {
        console.log("Resetting bbox")
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

  // select the widget with the current id
  const getWidgetById = (id) => {
    return widgets.find((widget) => widget.id === id);
  };

  return (
          <div style={{ height: '100%', maxHeight: '100%', width: '100%', maxWidth: '100%', overflow: 'hidden', position: 'relative'}}>
            <ControlPanel
              onRotateLeft={handleRotateLeft}
              onRotateRight={handleRotateRight}
              onBoundingBox={() => {setBboxSelected(true);}}
              onMove={handleMove}
              cameraConfig={cameraConfig}
              bboxSelected={bboxSelected}
            />

            <TransformWrapper
              style={{ maxHeight: '95%' }}
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
                   imageRef={imageRef}
                   selectedWidgetId={selectedWidgetId}
                   updateWidget={updateWidget}
                   widgets={widgets}
                   scale={scale}
                   dots={dots}
                   imgDims={imgDims}
                   rotate={rotate}
                   setSelectedWidgetId={setSelectedWidgetId}
                   setDots={setDots}
                   setImgDims={setImgDims}
                   bboxMarkers={bboxMarkers}
                   handlePhotoClick={bboxSelected ? handleBoundingBoxClick : handleGCPClick}
                   bboxClickCount={clickCount}
                   // onImageClick={handleBoundingBox}
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
  dots: PropTypes.object.isRequired,
  imgDims: PropTypes.object,
  setDots: PropTypes.func.isRequired,
  setImgDims: PropTypes.func.isRequired,
};

export default VideoTab;
