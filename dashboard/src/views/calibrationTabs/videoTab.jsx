import { useState, useRef } from 'react';
import { TransformWrapper } from 'react-zoom-pan-pinch';
import PhotoComponent from './photoComponent';
import ControlPanel from './controlPanel';
import PropTypes from 'prop-types';
import {useMessage} from "../../messageContext.jsx";
import {useDebouncedWsSender} from "../../api/api.js";

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
  const sendDebouncedMsg = useDebouncedWsSender(ws, 400);

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
