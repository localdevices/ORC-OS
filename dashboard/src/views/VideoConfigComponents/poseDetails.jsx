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

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const GcpData = await loadFile();
      // Clear existing widgets before adding new ones
      clearWidgets();

      // Additional steps after successful file load
      console.log("processing control point data...")
    } catch (error) {
      console.log("File loading not successful, do nothing...", error);
    }

  const loadFile = async () => {
    try {

      if (!formData.file) {
        setMessageInfo('error', 'Please select a file');
        return;
      }

      const fileFormData = new FormData();
      fileFormData.append("file", formData.file);

      try {
        const response = await api.post(
          '/control_points/from_csv/',
          fileFormData,
          {headers: {"Content-Type": "multipart/form-data"}}
        );
        setMessageInfo('success', 'Successfully loaded CSV file');
        return response.data;
      } catch (csvError) {
        try {
          const geoJsonResponse = await api.post(
            '/control_points/from_geojson/',
            fileFormData,
            {headers: {"Content-Type": "multipart/form-data"}}
          );

          setMessageInfo('success', 'Successfully loaded GeoJSON file');
          return geoJsonResponse.data;
        } catch (geoJsonError) {
          throw new Error(`Failed to parse file as CSV (${csvError.response.data.detail}) or as GeoJSON (${geoJsonError.response.data.detail})`);
        }
      }
    } catch (error) {
      console.error("Error occurred during file upload:", error);
      setMessageInfo('error', `Error: ${error.response?.data?.detail || error.message}`);
      throw error;  // error outside this function
    }
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
        <h5>Control points</h5>
        <label htmlFor='addWidget' className='form-label'>
          You may add control points manually one by one...
        </label>

        <button onClick={addWidget} id="addWidget" className="btn">Add GCP</button>
        <form onSubmit={handleSubmit}>

        <div className='mb-3 mt-3'>
          <label htmlFor='file' className='form-label'>
            Or choose a file (.csv with X, Y, Z, or GeoJSON)
          </label>
          <input type='file' className='form-control' id='file' name='file'
                 accept=".geojson,.csv" onChange={handleInputChange} required/>
        </div>
        </form>

        <button type='submit' className='btn'>
          Load control points
        </button>
        <button onClick={() => fitGcps(api, widgets, imgDims, epsgCode, setWidgets, setMessageInfo)} className="btn">Validate</button>
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
