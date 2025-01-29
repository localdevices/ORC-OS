import React, { useState, useRef, useEffect } from 'react';
import { TransformComponent, useTransformEffect, useTransformInit } from 'react-zoom-pan-pinch';

const PhotoComponent = ({imageRef, selectedWidgetId, updateWidget, widgets, scale, dots, setDots}) => {
  const [transformState, setTransformState] = useState(null);  // state of zoom is stored here
  const [photoBbox, setPhotoBbox ] = useState(null);
  const [imgDims, setImgDims] = useState(null);
  const [fittedPoints, setFittedPoints] = useState([]);

  useTransformInit(({state, instance}) => {
    // ensure the zoom/pan state is stored in a react state at the mounting of the photo element
    setTransformState(state);

  }, []);

  useEffect(() => {
    try {
      const imgElement = imageRef.current;
      setImgDims({width: imageRef.current.naturalWidth, height: imgElement.naturalHeight});
      setPhotoBbox(imgElement.getBoundingClientRect());
      updateFittedPoints();
    } catch {
      console.log("Image not yet initialized")}
  }, [widgets, transformState]);

  useTransformEffect(({ state, instance }) => {
    const imgElement = imageRef.current;
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
    const y = row / imgDims.height * photoBbox.height / transformState.Scale;
    return { x, y };
  };
  const updateFittedPoints = () => {
    const fP = widgets.map(({ id, fit, color }) => {
      if (!fit) return null; // Skip widgets without the `fit` property
      const { row, col } = fit;
      const screenPoint = convertToPhotoCoordinates(row, col);
      return {
        "id": id,
        "x": screenPoint.x,
        "y": screenPoint.y,
        "color": color
      }

    });
    setFittedPoints(fP);
    console.log(fP);

  }
  const handlePhotoClick = (event) => {
    event.stopPropagation();
    if (!transformState) {
      console.error("TransformContext state is null or uninitialized");
      return;
    }

    // Get the (x, y) position of the click relative to the visible image
    const clickX = event.clientX - photoBbox.left;
    const clickY = event.clientY - photoBbox.top;

    // Account for current zoom and pan state
    const { previousScale, scale, positionX, positionY } = transformState;

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
    alert("Please select a widget to update its row/column.");
    return;
  }

  // Update the dots
  setDots((prevDots) => ({
    ...prevDots,
    [selectedWidgetId]: { x: adjustedX, y: adjustedY, scale: scale, color: getWidgetById(selectedWidgetId).color },
  }));

  updateWidget(selectedWidgetId, {
    ...widgets.find((widget) => widget.id === selectedWidgetId).coordinates,
    row: originalRow,
    col: originalCol,
  });
  }
  return (
      <TransformComponent>
        <img
          style={{width: '100%', height: 'auto'}}
          className="img-calibration"
          ref={imageRef}
          onClick={handlePhotoClick}
          src="/frame_001.jpg" // Replace with the photo's path or URL
          alt="img-calibration"
        />
      {/* Render colored dots */}
      {Object.entries(dots).map(([widgetId, dot]) => {
        const imgElement = imageRef.current;
        return (
          <div
            key={widgetId}
            style={{
              position: "absolute",
              top: `${dot.y}px`,
              left: `${dot.x}px`,
              transform: "translate(-50%, -50%)",
              width: `${20 / scale}px`,
              height: `${20 / scale}px`,
              backgroundColor: "rgba(255,255,255,0.7)", // Change color as needed
              border: `${2 /scale}px solid ${dot.color}`,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000",
              fontSize: `${12 / scale}px`,
              fontWeight: "bold",
            }}
          >
          {widgetId}
          </div>
        );
       })}
      {/* Render colored dots */}
      {fittedPoints.map((point) => {
        if (!point || point.x === undefined || point.y === undefined) return null;
        return (
          <div
            key={point.id}
            style={{
              position: "absolute",
              top: `${point.y}px`,
              left: `${point.x}px`,
              transform: "translate(-50%, -50%)",
              width: `${10 / scale}px`,
              height: `${10 / scale}px`,
              backgroundColor: "rgba(255,255,255,0.7)", // Change color as needed
              border: `${2 /scale}px solid ${point.color}`,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#000",
              fontSize: `${12 / scale}px`,
              fontWeight: "bold",
            }}
          >
          {point.id}
          </div>
        );
       })}

    </TransformComponent>
  );
};
export default PhotoComponent;
