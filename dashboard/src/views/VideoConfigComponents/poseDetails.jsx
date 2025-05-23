import api from "../../api.js";
import React, {useEffect, useState} from "react";
import PropTypes from "prop-types";
import '../cameraAim.scss'
import {DropdownMenu} from "../../utils/dropdownMenu.jsx";
import {createCustomMarker} from "../../utils/leafletUtils.js";
import {rainbowColors} from "../../utils/helpers.jsx";
import XYZWidget from "../calibrationTabs/XyzWidget.jsx";
import {fitGcps} from "../../utils/apiCalls.jsx";

const PoseDetails = (
  {
    cameraConfig,
    widgets,
    dots,
    selectedWidgetId,
    setCameraConfig,
    setWidgets,
    setDots,
    setSelectedWidgetId,
    setMessageInfo
  }) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    data: ''
  });
  const [nextId, setNextId] = useState(1);  // widget ids increment automatically


  useEffect(() => {
    if (cameraConfig) {
      setFormData({
        name: cameraConfig.name || '',
        id: cameraConfig.id || '',
        data: JSON.stringify(cameraConfig.data, null, 4) || '',
      });
    } else {
      setFormData({
        name: '',
        id: '',
        data: '',
      })
    }

  }, [cameraConfig]);

  const addWidget = () => {
    setWidgets((prevWidgets) => {
      const color = rainbowColors[(nextId - 1) % rainbowColors.length];
      const newWidget = {
        id: nextId,
        color: color,
        coordinates: { x: '', y: '', z:'', row: '', col: ''},
        icon: createCustomMarker(color, nextId)  // for geographical plotting
      }
      // automatically select the newly created widget for editing
      setSelectedWidgetId(newWidget.id);

      return [
        ...prevWidgets,
        newWidget
      ]
    });
    setNextId((prevId) => prevId + 1); // increment the unique id for the next widget
    // setSelectedWidgetId
  };

  const deleteWidget = (id) => {
    // remove current widget from the list of widgets
    setWidgets((prevWidgets) => prevWidgets.filter((widget) => widget.id !== id));
    // also delete the dot
    setDots((prevDots) => {
      // Copy the previous state object
      const newDots = {...prevDots};
      delete newDots[id];
      return newDots;
    });
  };

  // remove all existing widgets
  const clearWidgets = () => {
    setWidgets([]);
    setDots([]);
    setSelectedWidgetId(null);
  }

  const handleInputChange = async (event) => {
    const {name, value, type} = event.target;
    const updatedFormData = {
      ...formData,
      [name]: value
    }
    setFormData(updatedFormData);

    try {
      const response = await api.post('/camera_config/update/', submitData(updatedFormData));
      setCameraConfig(response.data);
    } catch (error) {
      console.error('Error updating JSON:', error);
    }
  }


  return (
    <div className="split-screen" style={{overflow: 'auto'}}>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Set references</h5>
        <div className='mb-3 mt-3'>
          <label htmlFor='z_0' className='form-label small'>
            Water level in GCP axes [m]
          </label>
          <input type='number' className='form-control' id='z_0' name='z_0' onChange={handleInputChange} value="" required/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='h_ref' className='form-label small'>
            Water level local gauge [m]
          </label>
          <input type='number' className='form-control' id='h_ref' name='h_ref' onChange={handleInputChange} value="" required/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='crs' className='form-label small'>
            Coordinate reference system (only for GPS)
          </label>
          <input type='number' className='form-control' id='crs' name='crs' onChange={handleInputChange} value="" required/>
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='videoMode' className='form-label small'>
            Mode of video
          </label>
          <input type='radio' id='videoMode' name='videoMode' onChange={handleInputChange} value="1" required/>
        </div>
      </div>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Control Points</h5>
        <button onClick={addWidget} className="btn">Add GCP</button>
        <button onClick={() => fitGcps(api, widgets, imgDims, epsgCode, setWidgets, setMessageInfo)} className="btn">Fit GCPs</button>

        {widgets.map((widget) => (
          <div key={widget.id} onClick={() =>
            setSelectedWidgetId(widget.id)
          }
               style={{
                 border: selectedWidgetId === widget.id ? `4px solid ${widget.color}` : `1px solid ${widget.color}`,
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
              onDelete={() => {
                deleteWidget(widget.id);
              }}
            />
          </div>
        ))}

        <p>intentionally left blanc</p>
      </div>
    </div>

  )

};

export default PoseDetails;
