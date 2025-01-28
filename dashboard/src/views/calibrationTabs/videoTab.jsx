import React, { useState, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent, useTransformEffect, useTransformInit } from 'react-zoom-pan-pinch';
import PhotoComponent from './photoComponent';

const VideoTab = ({widgets, selectedWidgetId, updateWidget, dots, setDots}) => {
  const [scale, setScale] = useState(1);
  const imageRef = useRef(null);  // Reference to image within TransFormWrapper

  return (
    <div>
      <div>
          <div style={{ flex: 1}}>
             <TransformWrapper
               // ensure the scale is tracked all the time
               onTransformed={(e) => {
                 setScale(e.state.scale)
               }}
             >
                 <PhotoComponent
                   imageRef={imageRef}
                   selectedWidgetId={selectedWidgetId}
                   updateWidget={updateWidget}
                   widgets={widgets}
                   scale={scale}
                   dots={dots}
                   setDots={setDots}
                 />
            </TransformWrapper>
            <div style={{ textAlign: 'center', marginTop: '10px', color: '#555' }}>
              Click on the photo to select row/column
            </div>
          </div>
      <div>
        </div>
      </div>
      <h2>Current Coordinates:</h2>
      <pre>{JSON.stringify(widgets, null, 2)}</pre>
    </div>
  );
};

export default VideoTab;
