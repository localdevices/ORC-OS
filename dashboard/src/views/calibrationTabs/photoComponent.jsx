import {useState, useEffect, useRef} from 'react';
import {TransformComponent, useTransformEffect, useTransformInit} from 'react-zoom-pan-pinch';

import './photoComponent.css';
import PropTypes from 'prop-types';
import api from "../../api.js";

const PhotoComponent = (
  {
    video,
    imageRef,
    widgets,
    cameraConfig,
    scale,
    dots,
    imgDims,
    rotate,
    setCameraConfig,
    setDots,
    setImgDims,
    bboxMarkers,
    handlePhotoClick,
    bboxClickCount
  }) => {
  const [loading, setLoading] = useState(false); // Track the loading state of image
  const [transformState, setTransformState] = useState(null);  // state of zoom is stored here
  const [photoBbox, setPhotoBbox] = useState(null);
  const [fittedPoints, setFittedPoints] = useState([]);
  const [hoverCoordinates, setHoverCoordinates] = useState(null);
  const [lineCoordinates, setLineCoordinates] = useState(null);
  const [frameNr, setFrameNr] = useState(0);
  const [imageUrl, setImageUrl] = useState('/frame_001.jpg');
  const debounceTimeoutRef = useRef(null);  // state for timeout checking
  const abortControllerRef = useRef(null);  // state for aborting requests to api
  const [polygonPoints, setPolygonPoints] = useState([
    {x: 100, y: 100},
    {x: 300, y: 100},
    {x: 300, y: 300},
    {x: 100, y: 300}
  ]);

  const getFrameUrl = (frameNr, rotate) => {
    if (!video) return '';
    const apiHost = api.defaults.baseURL.replace(/\/$/, '');
    const frameUrl = `${apiHost}/video/${String(video.id)}/frame/${String(frameNr)}`;
    if (rotate !== null) {
      // ensure that if rotate is set, it is also parsed
      return `${frameUrl}?rotate=${rotate}`;
    }
    return frameUrl
  }

  useEffect(() => {
    // Update the image URL whenever frameNr or rotate changes
    const url = getFrameUrl(0, rotate);
    setImageUrl(url); // Set the new image URL
    setLoading(true); // Trigger loading state when the URL changes
  }, [rotate, video]);


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


  // Helper function
  const calculateLineCoordinates = (start, end) => {
    // Calculate pixel coordinates based on the bounding box and image dimensions
    const startPoint = {
      x: start.x,
      y: start.y,
    };
    const endPoint = {
      x: end.x, // (end.col / imgDims.width) * photoBbox.width,
      y: end.y // (end.row / imgDims.height) * photoBbox.height,
    };

    return { start: startPoint, end: endPoint };
  };

  // const dashedLineCoordinates = bboxClickCount === 1 && bboxMarkers.length > 0 && hoverCoordinates
  //   // dashed line, only displayed when the user has clicked once, and is seeking the second
  //   // coordinate for a bounding box
  //   ? calculateLineCoordinates(bboxMarkers[0], hoverCoordinates)
  //   : null;
  //

    const handleMouseMove = (event) => {
    if (!imageRef.current) return;
    if (!photoBbox || !imgDims || !transformState) return;

    // Calculate mouse position relative to the photo
    const hoverX = event.clientX - photoBbox.left;
    const hoverY = event.clientY - photoBbox.top;

    // Adjust for zoom scale using zoom state
    const adjustedX = hoverX / scale;
    const adjustedY = hoverY / scale;

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
    if (bboxClickCount === 1) {
      // a line should only be plotted dynamically when the user has already clicked once for a bounding box
      setLineCoordinates(calculateLineCoordinates(bboxMarkers[0], {x: adjustedX, y: adjustedY}));
    } else if (bboxClickCount === 2) {
      console.log(bboxMarkers);
      // when user has clicked twice, a dynamic polygon should be retrieved from api and plotted.
      // a timeout is necessary to ensure the polygon is only updated once every 0.3 seconds, to prevent too many calls
      // to the api.
      if (debounceTimeoutRef.current) {
        // get rid of earlier timeout if it exists
        clearTimeout(debounceTimeoutRef.current);
      }

      // also cancel any ongoing api call if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // set up a new abort controller for the new request upon mouse move
      abortControllerRef.current = new AbortController();
      const abortSignal = abortControllerRef.current.signal;

      // setup a timeout event with api call
      debounceTimeoutRef.current = setTimeout(async () => {
        // make simple list of lists for API call
        const points = bboxMarkers.map(p => [p.x, p.y]);
        points.push([adjustedX, adjustedY]);
        console.log(points);
        const url = "/camera_config/bounding_box/";
        const response = await api.post(
          url,
          {
            "camera_config": cameraConfig,
            "points": points,
          }
        )
          .then(response => {
            // console.log(response.data.bbox_camera);
            const bbox = response.data.bbox_camera;
            const bboxPoints = bbox.map(p => {
              const x = p[0] / imgDims.width * photoBbox.width / transformState.scale;
              const y = p[1] / imgDims.height * photoBbox.height/ transformState.scale;
              return {x, y};
            })
            setPolygonPoints(bboxPoints);
          })
      });
      setLineCoordinates(null);
    }  else {
      console.log("bboxClickCount === 2")
    }

  };

  // Reset hoverCoordinates when the mouse leaves the image
  const handleMouseLeave = () => {
    setHoverCoordinates(null);
    setLineCoordinates(null);
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


  useTransformEffect(({state}) => {
    const imgElement = imageRef.current;
    if (!imgElement) return;
    setPhotoBbox(imgElement.getBoundingClientRect());
    setTransformState(state); // Update the transformState on every transformation

    updateFittedPoints();
  });


  // Function to convert row/column to pixel coordinates
  const convertToPhotoCoordinates = (row, col) => {
    const x = col / imgDims.width * photoBbox.width / transformState.scale;
    const y = row / imgDims.height * photoBbox.height / transformState.scale;
    return {x, y};
  };

  const handleImageLoad = () => {
    setLoading(false);
    if (imageRef.current) {
      setImgDims({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
    }
  };

  const handleMouseClick = (event) => {
    // this function is called when the user clicks on the image. It starts with several general coordinate
    // properties, then calling a callback handlePhotoClick to do specific things with the coordinates.
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
    handlePhotoClick(
      adjustedX,
      adjustedY,
      normalizedX,
      normalizedY,
      originalRow,
      originalCol
    );
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
      <img
        style={{width: '100%', height: '100%'}}
        className="img-calibration"
        ref={imageRef}
        onClick={handleMouseClick}
        onLoad={handleImageLoad}
        onMouseMove={handleMouseMove} // Track mouse movement
        onMouseLeave={handleMouseLeave}
        src={imageUrl}
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
      {/* Render BBox markers */}
      {bboxMarkers.map((point) => {
        if (!point || point.x === undefined || point.y === undefined) return null;
        return (  // a '+' sign as marker for fitted points
          <div className="bbox-marker"
               key={point.id}
               style={{
                 top: `${point.y}px`,
                 left: `${point.x}px`,
                 width: `${20 / scale}px`,
                 height: `${20 / scale}px`,
                 fontSize: `${12 / scale}px`,
                 border: `${2 / scale}px solid white`,

               }}
          >
          </div>
        );
      })}
      {transformState && photoBbox && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none",
          }}
        >
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          >
            <polygon
              // points={polygonPoints
              //   .map(p => `${p.x / transformState.scale},${p.y / transformState.scale}`)
              //   .join(' ')}
              points={polygonPoints
                .map(p => `${p.x},${p.y}`)
                .join(' ')}
              fill="rgba(255, 255, 255, 0.3)"
              stroke="white"
              strokeWidth={2 / transformState.scale}
            />
          </svg>
        </div>
      )}
      {/* Render the dashed line */}
      {lineCoordinates && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            pointerEvents: "none", // Ensure it does not block interactions
          }}
        >
          <svg
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
            }}
          >
            <line
              x1={lineCoordinates.start.x}
              y1={lineCoordinates.start.y}
              x2={lineCoordinates.end.x}
              y2={lineCoordinates.end.y}

              // x1="0"
              // y1="0"
              // x2="100"
              // y2="100"
              stroke="#009ed3"
              strokeWidth="2"
              strokeDasharray="5,5" // Dashed line effect
            />
          </svg>
        </div>
      )}


    </TransformComponent>
      {loading && (
        <div className="spinner-container">
          <div className="spinner" />
        </div>
      )}

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
