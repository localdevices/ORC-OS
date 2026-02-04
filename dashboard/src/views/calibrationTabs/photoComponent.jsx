import {useState, useEffect, useRef} from 'react';
import {TransformComponent, useTransformEffect, useTransformInit} from 'react-zoom-pan-pinch';

import './photoComponent.css';
import PropTypes from 'prop-types';
import api, {useDebouncedWsSender} from "../../api/api.js";
import {rainbowColors} from "../../utils/helpers.jsx";
import { getFrameUrl, useDebouncedImageUrl, PolygonDrawer } from "../../utils/images.jsx";


const PhotoComponent = (
  {
    video,
    frameNr,
    imageRef,
    widgets,
    cameraConfig,
    scale,
    imgDims,
    rotate,
    bBoxPolygon,
    wettedBbox,
    CSDischarge,
    CSWaterLevel,
    dragging,
    setCameraConfig,
    setImgDims,
    setBBoxPolygon,
    setWettedBbox,
    bboxMarkers,
    handlePhotoClick,
    bboxClickCount,
    ws
  }) => {
  const [loading, setLoading] = useState(false); // Track the loading state of image
  const [transformState, setTransformState] = useState(null);  // state of zoom is stored here
  const [photoBbox, setPhotoBbox] = useState(null);
  const [fittedPoints, setFittedPoints] = useState([]);
  const [hoverCoordinates, setHoverCoordinates] = useState(null);
  const [lineCoordinates, setLineCoordinates] = useState(null);
  const [imageUrl, setImageUrl] = useState('');  ///frame_001.jpg
  const debounceTimeoutRef = useRef(null);  // state for timeout checking
  const abortControllerRef = useRef(null);  // state for aborting requests to api
  const lastResponse = useRef(null);  // store last API response
  const [CSDischargePolygon, setCSDischargePolygon] = useState([]);
  const [CSWettedSurfacePolygon, setCSWettedSurfacePolygon] = useState([]);
  const [CSWaterLevelPolygon, setCSWaterLevelPolygon] = useState([]);
  const [CSWaterLines, setCSWaterLines] = useState([]);  // lines at water/land interface
  const [dots, setDots] = useState({}); // Array of { x, y, id } objects

  // set a mouseDown state for tracking mouse behaviour
  const mouseDownTimeRef = useRef(0);
  const sendDebouncedMsg = useDebouncedWsSender(ws, 100);

  const checkImageReady = () => {
    // check if image is loaded, transform wrapper is ready and image dimensions set
    return (
      photoBbox !== null &&
      imgDims !== null &&
      transformState !== null &&
      imgDims?.width !== 0 &&
      imgDims?.height !== 0
    );
  };

  // helper function to transform list of coordinates
  const transformCoords = (coords) => {
    return coords.map(p => {
      const x = p[0] / imgDims.width * photoBbox.width / transformState.scale;
      const y = p[1] / imgDims.height * photoBbox.height / transformState.scale;
      return {x, y};
    })
  }

  // useEffect(() => {
  //   // ensure if click count is 3, the camera config is updated with the set bbox
  //   if (bboxClickCount === 3) {
  //     setCameraConfig(lastResponse.current.data)
  //   }
  // }, [bboxClickCount])

  useEffect(() => {
    // check if image and dimensions are entirely intialized
    if (checkImageReady()) {
      let newBboxPoints;
      // all cam config info is present
      if (cameraConfig && cameraConfig?.bbox_camera && cameraConfig?.bbox_camera !== null) {
        // update the polygon points with the cameraConfig.bbox_image points
        newBboxPoints = transformCoords(cameraConfig.bbox_camera);
      } else {
        newBboxPoints = []
      }
    setBBoxPolygon(newBboxPoints);
      // only gcps are present
      if (cameraConfig && cameraConfig?.gcps?.control_points) {
        updateFittedPoints();
        updateDots();
      // nothing is present
      } else {
        setDots({});
        setFittedPoints([]);
        setBBoxPolygon([]);
      }
    }
  }, [cameraConfig, imgDims, transformState, photoBbox]);

  useEffect(() => {
    // set cross sections
    if (
      checkImageReady() &&
      // CSDischarge &&
      CSDischarge?.bottom_surface
    ) {
      const newCSPolPoints = transformCoords(CSDischarge.bottom_surface);
      setCSDischargePolygon(newCSPolPoints);
      const newWetPolPoints = transformCoords(CSDischarge.wetted_surface);
      setCSWettedSurfacePolygon(newWetPolPoints);
      const newWaterLines = CSDischarge.water_lines.map(line => transformCoords(line))
      setCSWaterLines(newWaterLines);
    } else {
      if (CSDischargePolygon.length > 0) {
        setCSDischargePolygon([]);
      }
      if (CSWettedSurfacePolygon.length > 0) {
        setCSWettedSurfacePolygon([]);
      }
    }
    if (
      checkImageReady() &&
      // CSDischarge &&
      CSDischarge?.bbox_wet
    ) {
      const newBboxWetPoints = CSDischarge.bbox_wet.map(pol => transformCoords(pol));
      setWettedBbox(newBboxWetPoints);
    }
  }, [CSDischarge, cameraConfig, imgDims, transformState, photoBbox]);

  useEffect(() => {
    if (
      checkImageReady() &&
      // CSWaterLevel &&
      CSWaterLevel?.bottom_surface
    ) {

      const newCSPolPoints = CSWaterLevel.bottom_surface.map(p => {
        const x = p[0] / imgDims.width * photoBbox.width / transformState.scale;
        const y = p[1] / imgDims.height * photoBbox.height / transformState.scale;
        return {x, y};
      })
      setCSWaterLevelPolygon(newCSPolPoints);


    } else {
      if (CSWaterLevelPolygon.length > 0) {
        setCSWaterLevelPolygon([]);
      }
    }
  }, [CSWaterLevel?.bottom_surface, cameraConfig, imgDims, transformState, photoBbox]);

  useTransformEffect(({state}) => {
    const imgElement = imageRef.current;
    if (!imgElement) return;
    const updateTransform = () => {
      setPhotoBbox(imgElement.getBoundingClientRect());
      setTransformState(state); // Update the transformState on every transformation
    }
    updateTransform();
  });

  useDebouncedImageUrl({
    setImageUrl,
    deps: [rotate, video, frameNr],
    urlBuilder: () => getFrameUrl(video, frameNr, rotate),
    onUrlReady: (url, { cached }) => {
      if (cached) {
        setLoading(false);
      }
    },
    delayMs: 300
  });


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


  // create line coordinates for dashed line from first to second point for bounding box
  const calculateLineCoordinates = (start, end) => {
    // Calculate pixel coordinates based on the bounding box and image dimensions
    const startPoint = {
      x: start.x,
      y: start.y,
    };
    const endPoint = {
      x: end.x,
      y: end.y
    };

    return { start: startPoint, end: endPoint };
  };

  // Mouse behaviour functions
  // -------------------------
  // Handle mouse down
  const handleMouseDown = () => {
    mouseDownTimeRef.current = Date.now(); // Save the current time
  };

  // Handle mouse up
  const handleMouseUp = (event) => {
    const clickDuration = Date.now() - mouseDownTimeRef.current;
    // Only consider it a "click" if dragging did not occur and the click was fast enough
    if (clickDuration < 200) {
      handleMouseClick(event); // Call click event
    }
  };

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
    // console.log(row, col)
    setHoverCoordinates({ row, col });
    if (bboxClickCount === 1) {
      // a line should only be plotted dynamically when the user has already clicked once for a bounding box
      setLineCoordinates(calculateLineCoordinates(bboxMarkers[0], {x: adjustedX, y: adjustedY}));
    } else if (bboxClickCount === 2) {
      // when user has clicked twice, a dynamic polygon should be retrieved from api and plotted.
      // a timeout is necessary to ensure the polygon is only updated once every 0.3 seconds, to prevent too many calls
      // to the api.
      // if (debounceTimeoutRef.current) {
      //   // get rid of earlier timeout if it exists
      //   clearTimeout(debounceTimeoutRef.current);
      // }
      //
      // // also cancel any ongoing api call if it exists
      // if (abortControllerRef.current) {
      //   abortControllerRef.current.abort();
      // }
      //
      // // set up a new abort controller for the new request upon mouse move
      // abortControllerRef.current = new AbortController();
      // const abortSignal = abortControllerRef.current.signal;
      //
      // setup a timeout event with api call
      const points = bboxMarkers.map(p => [p.col, p.row]);
      points.push([col, row]);
      const msg = {
        action: "update_video_config",
        op: "set_bbox_from_width_length",
        params: {
          points: points
        }
      }
      sendDebouncedMsg(msg);
      // debounceTimeoutRef.current = setTimeout(async () => {
      //   // make simple list of lists for API call
      //   const points = bboxMarkers.map(p => [p.col, p.row]);
      //   points.push([col, row]);
      //   const url = "/camera_config/bounding_box/";
      //   const response = await api.post(
      //     url,
      //     {
      //       "camera_config": cameraConfig,
      //       "points": points,
      //     }
      //   )
      //     .then(response => {
      //       lastResponse.current = response;
      //       const bbox = response.data.bbox_camera;
      //       // set the bbox_camera on the current cameraConfig
      //       bboxPoints = bbox.map(p => {
      //         const x = p[0] / imgDims.width * photoBbox.width / transformState.scale;
      //         const y = p[1] / imgDims.height * photoBbox.height/ transformState.scale;
      //         return {x, y};
      //       })
      //       setBBoxPolygon(bboxPoints);
      //     })
      // }, 100);
      setLineCoordinates(null);
    }

  };

  // Reset hoverCoordinates when the mouse leaves the image
  const handleMouseLeave = () => {
    setHoverCoordinates(null);
    setLineCoordinates(null);
  };

  // update the dot locations when user resizes the browser window or changes gcps otherwise
  const updateDots = () => {
    try {
      const updatedDots = cameraConfig.gcps.control_points.reduce((acc, gcp, idx) => {
        if (gcp.row !== null && gcp.col !== null) {
          const screenPoint = convertToPhotoCoordinates(gcp.row, gcp.col);
          acc[idx + 1] = {
            x: screenPoint.x,
            y: screenPoint.y,
            color: rainbowColors[(idx) % rainbowColors.length] || 'ffffff'
          };
        }
        return acc;
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

    const parentContainer = imageRef.current.parentElement.parentElement.parentElement.parentElement;
    if (parentContainer) {
      parentContainer.addEventListener("scroll", handleResize);
    }

      return () => {
      window.removeEventListener("resize", handleResize);
      parentContainer.removeEventListener("scroll", handleResize);
    };


  }, [imageRef, updateFittedPoints]);

  // Function to convert row/column to pixel coordinates
  const convertToPhotoCoordinates = (row, col) => {
    const x = col / imgDims.width * photoBbox.width / transformState.scale;
    const y = row / imgDims.height * photoBbox.height / transformState.scale;
    return {x, y};
  };

  const handleImageLoad = () => {
    if (imageRef.current && imageUrl) {
      setImgDims({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
      setLoading(false); // Ensure loading state is set to false after dimensions are set
    }
  };


  const handleMouseClick = (event) => {
    // this function is called when the user clicks on the image. It starts with several general coordinate
    // properties, then calling a callback handlePhotoClick to do specific things with the coordinates.
    if (!imageRef.current) return;

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
      originalCol,
    );
  }


  PhotoComponent.propTypes = {
      video: PropTypes.shape({
        id: PropTypes.oneOfType([PropTypes.number, PropTypes.string])
    }),

    imageRef: PropTypes.shape({ current: PropTypes.instanceOf(Element) }),
    selectedWidgetId: PropTypes.number,
    widgets: PropTypes.arrayOf(PropTypes.shape({
      id: PropTypes.number.isRequired,
      fit: PropTypes.shape({
        row: PropTypes.number,
        col: PropTypes.number
      }),
      color: PropTypes.string
    })).isRequired,
    scale: PropTypes.number,
    imgDims: PropTypes.shape({
      width: PropTypes.number.isRequired,
      height: PropTypes.number.isRequired
    }),
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
        // onClick={handleMouseClick}
        onLoad={() => {
          setLoading(true);
          handleImageLoad()
        }}
        onError={() => {
          setLoading(false); // Always unset loading on error
          console.error('Image failed to load.');
        }}

        onMouseMove={handleMouseMove} // Track mouse movement
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
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
      {transformState && photoBbox && bBoxPolygon && (
        <PolygonDrawer
          points={bBoxPolygon}
          fill={"rgba(255, 255, 255, 0.3)"}
          stroke={"white"}
          strokeWidth={2 / transformState.scale}
          zIndex={0}

        />

      )}
      {/*Render Discharge Cross Section*/}
      {transformState && photoBbox && CSDischargePolygon && (
        <PolygonDrawer
          points={CSDischargePolygon}
          fill={"rgba(75, 192, 192, 0.3)"}
          stroke={"white"}
          strokeWidth={2 / transformState.scale}
          zIndex={0}
          />
      )}
      {/*Render Discharge Cross Section*/}
      {transformState && photoBbox && CSWettedSurfacePolygon && (
        <PolygonDrawer
          points={CSWettedSurfacePolygon}
          fill={"rgba(75, 130, 192, 0.3)"}
          stroke={"white"}
          strokeWidth={2 / transformState.scale}
          zIndex={0}
        />
      )}
      {/*Render Water Level Cross Section*/}
      {transformState && photoBbox && CSWaterLevelPolygon && (
        <PolygonDrawer
          points={CSWaterLevelPolygon}
          fill={"rgba(255, 99, 132, 0.3)"}
          stroke={"rgba(255, 160, 0, 1)"}
          strokeWidth={4 / transformState.scale}
          zIndex={0}
        />
      )}
      {/*wetted part of bounding box*/}
      {transformState && photoBbox && wettedBbox && wettedBbox.length > 0 && wettedBbox.map((line, idx) => (
        <PolygonDrawer
          points={line}
          key={`bbox wet pol ${idx}`}
          fill={"rgba(75, 75, 192, 0.3)"}
          stroke={"rgba(75, 75, 192, 1)"}
          strokeWidth={2 / transformState.scale}
          zIndex={1}
        />

      ))}

      {/*/!*Render the water/land boundary lines*!/*/}
      {/*{transformState && photoBbox && CSWaterLines && CSWaterLines.length > 0 && CSWaterLines.map((line, idx) => (*/}
      {/*  <PolygonDrawer*/}
      {/*    points={line}*/}
      {/*    key={`water line ${idx}`}*/}
      {/*    fill={"rgba(75, 130, 192, 0.3)"}*/}
      {/*    stroke={"red"}*/}
      {/*    strokeWidth={2 / transformState.scale}*/}
      {/*    zIndex={1}*/}
      {/*  />*/}
      {/*))}*/}

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
              stroke="#009ed3"
              strokeWidth="2"
              strokeDasharray="5,5" // Dashed line effect
            />
          </svg>
        </div>
      )}
    </TransformComponent>
      {loading && (
        <div className="spinner-viewport">
          <div className="spinner" />
          <div>Loading frame...</div>

        </div>
      )}

      {hoverCoordinates && (
        <div
          style={{
            position: 'absolute',
            top: "40px",
            left: "5px",
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
