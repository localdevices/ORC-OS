import React, { useState, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent, useTransformContext, useTransformEffect, useTransformInit } from 'react-zoom-pan-pinch';
import XYZWidget from './XyzWidget';

const ControlPointsTab = () => {
  const [widgets, setWidgets] = useState([]);
  const [nextId, setNextId] = useState(1);  // widget ids increment automatically
  const [selectedWidgetId, setSelectedWidgetId] = useState(null); // To track which widget is being updated
  const [dots, setDots] = useState([]); // Array of { x, y, id } objects
  const imageRef = useRef(null);  // Reference to image within TransFormWrapper

  const addWidget = () => {
    setWidgets((prevWidgets) => [
      ...prevWidgets,
      { id: nextId, coordinates: { x: '', y: '', z: '', row: '', col: ''  } },
    ]);
    setNextId((prevId) => prevId + 1); // increment the unique id for the next widget

  };

  const updateWidget = (id, updatedCoordinates) => {
    setWidgets((prevWidgets) =>
      prevWidgets.map((widget) =>
        widget.id === id ? { ...widget, coordinates: updatedCoordinates } : widget
      )
    );
  };

  const deleteWidget = (id) => {
    setWidgets((prevWidgets) => prevWidgets.filter((widget) => widget.id !== id));
    // also delete the dot
  };

const HandlePhotoClickContext = () => {
  const [transformState, setTransformState] = useState(null);  // state of zoom is stored here

  useTransformInit(({state, instance}) => {
    // ensure the zoom/pan state is stored in a react state at the mounting of the photo element
    setTransformState(state);
  }, []);

  useTransformEffect(({ state, instance }) => {
    setTransformState(state); // Update the transformState on every transformation
  });

  const handlePhotoClick = (event) => {
//       console.log(transformState);
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
    [selectedWidgetId]: { x: adjustedX, y: adjustedY },
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
              width: "20px",
              height: "20px",
              backgroundColor: "red", // Change color as needed
              borderRadius: "50%",
              transform: "translate(-50%, -50%)", // Center the dot
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: "8px",
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

  return (
    <div>
      <h1>Camera calibration</h1>
      <div style={{ display: 'flex', margin: '20px' }}>
          <div style={{ flex: 1, border: '1px solid black', marginRight: '20px', position: 'relative' }}>
             <TransformWrapper>
                 <HandlePhotoClickContext
                   selectedWidgetId={selectedWidgetId}
                   setDots={setDots}
                   setWidgets={setWidgets}
                 />
            </TransformWrapper>
            <div style={{ textAlign: 'center', marginTop: '10px', color: '#555' }}>
              Click on the photo to select row/column
            </div>
          </div>
      <div>
      <div style={{ flex: 1 }}>
          <button onClick={addWidget} className="btn">Add Widget</button>
          {widgets.map((widget) => (
            <div key={widget.id} onClick={(event) =>
                setSelectedWidgetId(widget.id)
              }
              style={{
                border: selectedWidgetId === widget.id ? '4px solid red' : '1px solid black',
                marginBottom: '10px',
                padding: '10px',
                color: 'white',
                cursor: 'pointer',
              }}
            >
              <XYZWidget
                id={widget.id}
                coordinates={widget.coordinates}
                onUpdate={(id, coordinates) => updateWidget(id, coordinates)}
                onDelete={deleteWidget}
              />
            </div>
          ))}
      </div>
        </div>
      </div>
      <h2>Current Coordinates:</h2>
      <pre>{JSON.stringify(widgets, null, 2)}</pre>
    </div>
  );
};

export default ControlPointsTab;
