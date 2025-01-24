import React, { useState, useRef } from 'react';
import { TransformComponent, useTransformEffect, useTransformInit } from 'react-zoom-pan-pinch';

const PhotoComponent = ({imageRef, selectedWidgetId, updateWidget, widgets, scale}) => {
  const [transformState, setTransformState] = useState(null);  // state of zoom is stored here
  const [dots, setDots] = useState([]); // Array of { x, y, id } objects

  useTransformInit(({state, instance}) => {
    // ensure the zoom/pan state is stored in a react state at the mounting of the photo element
    setTransformState(state);
  }, []);

  useTransformEffect(({ state, instance }) => {
    setTransformState(state); // Update the transformState on every transformation
  });

  const handlePhotoClick = (event) => {
    event.stopPropagation();
    if (!transformState) {
      console.error("TransformContext state is null or uninitialized");
      return;
    }

    const imgElement = imageRef.current;
    if (!imgElement) return;
    //  The <img> element
    const boundingBox = imgElement.getBoundingClientRect(); // The rendered image dimensions on screen
    // Get the (x, y) position of the click relative to the visible image
    const clickX = event.clientX - boundingBox.left;
    const clickY = event.clientY - boundingBox.top;
    // Account for current zoom and pan state
    const { previousScale, scale, positionX, positionY } = transformState;

    // Use normalized coordinates relative to the original image dimensions
    const normalizedX = clickX / boundingBox.width;  // X in percentage of displayed width
    const normalizedY = clickY / boundingBox.height; // Y in percentage of displayed height

    // Get the original image dimensions
    const originalWidth = imgElement.naturalWidth; // Original image width (pixels)
    const originalHeight = imgElement.naturalHeight; // Original image height (pixels)

    // Adjust for zoom scale using zoom state
    const adjustedX = clickX / scale;
    const adjustedY = clickY / scale;
    // Calculate the row and column on the **original image** (as percentages)
    const originalRow = Math.round(normalizedY * originalHeight * 100) / 100;
    const originalCol = Math.round(normalizedX * originalWidth * 100) / 100;

   // Add the new dot to the state with the ID of the associated widget
  if (!selectedWidgetId) {
    alert("Please select a widget to update its row/column.");
    return;
  }

  // Update the dots
  setDots((prevDots) => ({
    ...prevDots,
    [selectedWidgetId]: { x: adjustedX, y: adjustedY, scale: scale },
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
          className="img-calibration"
          ref={imageRef}
          onClick={handlePhotoClick}
          src="/frame_001.jpg" // Replace with the photo's path or URL
          alt="img-calibration"
        />
      {/* Render colored dots */}
      {Object.entries(dots).map(([widgetId, dot]) => {
        const imgElement = imageRef.current;
        const boundingBox = imgElement.getBoundingClientRect();
//         console.log(boundingBox);
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
              backgroundColor: "red", // Change color as needed
              borderRadius: "50%",
              transform: "translate(-50%, -50%)", // Center the dot
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: `${10 / scale}px`,
              fontWeight: "bold",
            }}
          >
          {widgetId}
          </div>
        );
       })}
    </TransformComponent>
  );
};
export default PhotoComponent;
