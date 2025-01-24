import React, { useState, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent, useTransformEffect, useTransformInit } from 'react-zoom-pan-pinch';
import XYZWidget from './XyzWidget';
import PhotoComponent from './photoComponent';

const VideoTab = () => {
  const [widgets, setWidgets] = useState([]);
  const [nextId, setNextId] = useState(1);  // widget ids increment automatically
  const [selectedWidgetId, setSelectedWidgetId] = useState(null); // To track which widget is being updated
  const [scale, setScale] = useState(1);
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

  return (
    <div>
      <div style={{ display: 'flex', margin: '20px' }}>
          <div style={{ flex: 1, border: '1px solid black', marginRight: '20px', position: 'relative' }}>
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
                marginTop: '10px',
                marginBottom: '10px',
                padding: '5px',
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

export default VideoTab;
