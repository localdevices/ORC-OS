import { useState, useRef } from 'react';
import { TransformWrapper } from 'react-zoom-pan-pinch';
import PhotoComponent from './photoComponent';
import ControlPanel from './controlPanel';
import PropTypes from 'prop-types';

const VideoTab = (
  {
    video,
    widgets,
    selectedWidgetId,
    updateWidget,
    dots,
    imgDims,
    rotate,
    setDots,
    setImgDims,
  }
) => {
  const [scale, setScale] = useState(1);
  const imageRef = useRef(null);  // Reference to image within TransFormWrapper


  const handleBoundingBox = () => {
    console.log('Draw Bounding Box');
    // Implement bounding box logic
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
                   imageRef={imageRef}
                   selectedWidgetId={selectedWidgetId}
                   updateWidget={updateWidget}
                   widgets={widgets}
                   scale={scale}
                   dots={dots}
                   imgDims={imgDims}
                   rotate={rotate}
                   setDots={setDots}
                   setImgDims={setImgDims}
                 />
            </TransformWrapper>
            <div style={{ textAlign: 'center', marginTop: '10px', color: '#555' }}>
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
