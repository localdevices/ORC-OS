import {useState, useEffect} from 'react';
import {TransformComponent, useTransformEffect, useTransformInit} from 'react-zoom-pan-pinch';

import './photoComponent.css';
import PropTypes from 'prop-types';
import api from "../../api.js";

const PhotoComponent = (
  {
    video,
    imageRef,
    selectedWidgetId,
    updateWidget,
    widgets,
    scale,
    dots,
    imgDims,
    setDots,
    setImgDims
  }) => {
  const [transformState, setTransformState] = useState(null);  // state of zoom is stored here
  const [photoBbox, setPhotoBbox] = useState(null);
  const [fittedPoints, setFittedPoints] = useState([]);
  const [hoverCoordinates, setHoverCoordinates] = useState(null);
  const [frameNr, setFrameNr] = useState(0);
  const [imageUrl, setImageUrl] = useState('/frame_001.jpg');

  const updateFittedPoints = () => {
    const fP = widgets.map(({id, fit, color}) => {
      if (!fit) return null; // Skip widgets without the `fit` property
      const {row, col} = fit;
      const screenPoint = convertToPhotoCoordinates(row, col);
      return {
        "id": id,
        "x": screenPoint.x,
        "y": screenPoint.y,
        "color": color
      }

    });
    setFittedPoints(fP);
  }

  const getFrameUrl = (frameNr) => {
    if (!video) return '';
    const apiHost = api.defaults.baseURL.replace(/\/$/, '');
    const frameUrl = `${apiHost}/video/${String(video.id)}/frame/${String(frameNr)}`;
    return frameUrl
  }
  const handleMouseMove = (event) => {
    if (!imageRef.current) return;
    if (!photoBbox || !imgDims || !transformState) return;

    // Calculate mouse position relative to the photo
    const hoverX = event.clientX - photoBbox.left;
    const hoverY = event.clientY - photoBbox.top;

    // Are we hovering *within* the photo’s boundaries?
    if (hoverX < 0 || hoverX > photoBbox.width || hoverY < 0 || hoverY > photoBbox.height) {
      setHoverCoordinates(null);
      return;
    }

    // Convert hover position to row/column coordinates relative to original image
    const normalizedX = hoverX / photoBbox.width;
    const normalizedY = hoverY / photoBbox.height;

    const row = Math.round(normalizedY * imgDims.height * 100) / 100;
    const col = Math.round(normalizedX * imgDims.width * 100) / 100;

    setHoverCoordinates({ row, col });
  };

  // Reset hoverCoordinates when the mouse leaves the image
  const handleMouseLeave = () => {
    setHoverCoordinates(null);
  };

  // update the dot locations when user resizes the browser window
  const updateDots = () => {
    try {
      const updatedDots = Object.entries(dots).reduce((newDots, [id, dot]) => {
        const newX = dot.xNorm * photoBbox.width / transformState.scale; //
        const newY = dot.yNorm * photoBbox.height / transformState.scale; //
        // Recalculate the actual position relative to the new photoBbox and dimensions
        newDots[id] = {
          ...dot,
          x: newX,
          y: newY,
        };
        return newDots;
      }, {});
      setDots(updatedDots);
    } catch {
      console.log("Skipping dot rendering, image not yet initialized")
    }

  }

  // run these as soon as the TransformComponent is ready
  useTransformInit(({state}) => {
    // ensure the zoom/pan state is stored in a react state at the mounting of the photo element
    setTransformState(state);
    // ensure we have a method (event listener) to reproject the plotted points upon changes in window size
    const handleResize = () => {
      const imgElement = imageRef.current;
      if (!imgElement) return;
      setPhotoBbox(imgElement.getBoundingClientRect());
      setTransformState(state); // Update the transformState on every transformation

    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
    };

  }, [imageRef, updateFittedPoints]);

  // triggered when user resizes the window, after this, the dot locations must be updated
  useEffect(() => {
    updateDots();
  }, [photoBbox]);  // TODO: updateDots is a dependency, but it changes all the time, perhaps put updateDots inside useEffect


  useEffect(() => {
    try {
      const imgElement = imageRef.current;
      setImgDims({width: imageRef.current.naturalWidth, height: imgElement.naturalHeight});
      setPhotoBbox(imgElement.getBoundingClientRect());
      updateFittedPoints();

      // updateFittedPoints();
    } catch {
      console.error("Image not yet initialized")
    }
  }, [widgets, transformState, window]);

  // useEffect(() => {
  //   const loadFrame = async () => {
  //     const url = await getFrame(frameNr);
  //     if (url) setImageUrl(url);
  //   };
  //   loadFrame();
  // }, [frameNr]);


  useTransformEffect(({state}) => {
    const imgElement = imageRef.current;
    if (!imgElement) return;
    setPhotoBbox(imgElement.getBoundingClientRect());
    setTransformState(state); // Update the transformState on every transformation

    updateFittedPoints();
  });

  // select the widget with the current id
  const getWidgetById = (id) => {
    return widgets.find((widget) => widget.id === id);
  };

  // Function to convert row/column to pixel coordinates
  const convertToPhotoCoordinates = (row, col) => {
    const x = col / imgDims.width * photoBbox.width / transformState.scale;
    const y = row / imgDims.height * photoBbox.height / transformState.scale;
    return {x, y};
  };

  const handleImageLoad = () => {
    if (imageRef.current) {
      setImgDims({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
    }
  };


  const handlePhotoClick = (event) => {
    if (!imageRef.current) return;
    event.stopPropagation();
    if (!transformState) {
      console.error("TransformContext state is null or uninitialized");
      return;
    }

    // Get the (x, y) position of the click relative to the visible image
    const clickX = event.clientX - photoBbox.left;
    const clickY = event.clientY - photoBbox.top;

    // Account for current zoom and pan state
    const {scale} = transformState;

    // Use normalized coordinates relative to the original image dimensions
    const normalizedX = clickX / photoBbox.width;  // X in percentage of displayed width
    const normalizedY = clickY / photoBbox.height; // Y in percentage of displayed height

    // Adjust for zoom scale using zoom state
    const adjustedX = clickX / scale;
    const adjustedY = clickY / scale;


    // Calculate the row and column on the **original image** (as percentages)
    const originalRow = Math.round(normalizedY * imgDims.height * 100) / 100;
    const originalCol = Math.round(normalizedX * imgDims.width * 100) / 100;
    // Add the new dot to the state with the ID of the associated widget
    if (!selectedWidgetId) {
      alert(`Please select a widget to update its row/column.`);
      return;
    } else {
      console.log(`SELECTED WIDGET: ${selectedWidgetId}`)

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
    }
  }
  PhotoComponent.propTypes = {
      video: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    }),

    imageRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    selectedWidgetId: PropTypes.number,
    updateWidget: PropTypes.func.isRequired,
    widgets: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number.isRequired,
      fit: PropTypes.shape({
        row: PropTypes.number,
        col: PropTypes.number
      }),
      color: PropTypes.string
    })).isRequired,
    scale: PropTypes.number,
    dots: PropTypes.object.isRequired,
    imgDims: PropTypes.shape({
      width: PropTypes.number.isRequired,
      height: PropTypes.number.isRequired
    }),
    setDots: PropTypes.func.isRequired,
    setImgDims: PropTypes.func.isRequired
  };

  return (
    <>
    <TransformComponent>
      <div className="image-container">
        {/*{video ? (*/}
        {/*<p>image loading...</p>)*/}
        {/*: (*/}
      <img
        style={{width: '100%', height: '100%'}}
        className="img-calibration"
        ref={imageRef}
        onClick={handlePhotoClick}
        onLoad={handleImageLoad}
        onMouseMove={handleMouseMove} // Track mouse movement
        onMouseLeave={handleMouseLeave}
        src={getFrameUrl(0)}
        // src="http://localhost:5000/video/1/frame/1"
        alt="img-calibration"
      />
      </div>
      {/* Render colored dots */}
      {Object.entries(dots).map(([widgetId, dot]) => {
        return (
          <div className="gcp-icon"
               key={widgetId}
               style={{
                 top: `${dot.y}px`,
                 left: `${dot.x}px`,
                 width: `${20 / scale}px`,
                 height: `${20 / scale}px`,
                 border: `${2 / scale}px solid ${dot.color}`,
                 fontSize: `${12 / scale}px`,
               }}
          >
            {widgetId}
          </div>
        );
      })}
      {/* Render fitted points */}
      {fittedPoints.map((point) => {
        if (!point || point.x === undefined || point.y === undefined) return null;
        return (  // a '+' sign as marker for fitted points
          <div className="gcp-icon fitted"
               key={point.id}
               style={{
                 top: `${point.y}px`,
                 left: `${point.x}px`,
                 width: `${10 / scale}px`,
                 height: `${10 / scale}px`,
                 color: `${point.color}`,
                 fontSize: `${40 / scale}px`,
               }}
          >
            +
          </div>
        );
      })}
    </TransformComponent>
      {hoverCoordinates && (
        <div
          style={{
            position: 'absolute',
            top: "10px",
            left: "10px",
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            color: 'white',
            padding: '5px 10px',
            borderRadius: '5px',
            fontSize: '12px',
            pointerEvents: 'none', // ensure that the pointer events are captured on the image below.
            zIndex: 1000,
          }}
        >
          {/* Use fixed-width span for consistent alignment */}
          <span style={{ display: 'inline-block', width: '4ch', textAlign: 'right' }}>
            Row:
          </span>
          <span style={{ display: 'inline-block', width: '5ch', textAlign: 'right' }}>
            {hoverCoordinates.row.toString().padStart(3, '0')}
          </span>
          <span style={{ display: 'inline-block', width: '4ch', textAlign: 'right' }}>
            Col:
          </span>
          <span style={{ display: 'inline-block', width: '5ch', textAlign: 'right' }}>
            {hoverCoordinates.col.toString().padStart(3, '0')}
          </span>
        </div>
      )}
   </>
  );
};
export default PhotoComponent;
