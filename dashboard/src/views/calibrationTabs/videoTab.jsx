import { useState, useRef } from 'react';
import { TransformWrapper } from 'react-zoom-pan-pinch';
import PhotoComponent from './photoComponent';
import ControlPanel from './controlPanel';
import PropTypes from 'prop-types';

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
  const [markers, setMarkers] = useState([]);
  const [clickCount, setClickCount] = useState(0);
  const imageRef = useRef(null);  // Reference to image within TransFormWrapper


  const handleBoundingBox = (event) => {
    if (clickCount >= 3) return;

    const rect = event.target.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    const newMarkers = [...markers, {x, y}];
    setMarkers(newMarkers);
    setClickCount(clickCount + 1);

    if (clickCount === 2) {
      // Draw final marker and reset
      setTimeout(() => {
        setMarkers([]);
        setClickCount(0);
      }, 2000);
    }
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
          <div style={{ height: '100%', maxHeight: '100%', width: '100%', maxWidth: '100%', overflow: 'hidden', position: 'relative'}}>
            <ControlPanel
              onRotateLeft={handleRotateLeft}
              onRotateRight={handleRotateRight}
              onBoundingBox={handleBoundingBox}
              onMove={handleMove}
              cameraConfig={cameraConfig}
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
                   markers={markers}
                   onImageClick={handleBoundingBox}
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
