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
    crs: '',
    data: ''

  });

  const [fileFormData, setFileFormData] = useState({
    file: '',
  });

  const [nextId, setNextId] = useState(1);  // widget ids increment automatically


  useEffect(() => {
    if (cameraConfig) {
      setFormData({
        name: cameraConfig.name || '',
        id: cameraConfig.id || '',
        data: JSON.stringify(cameraConfig.data, null, 4) || '',
        crs: JSON.stringify(cameraConfig.crs, null, 4) || '',

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
      // Parse coordinates and create new widgets
      const updatedFormData = {
        ...formData,
        ["crs"]: GcpData.crs
      }
      setFormData(updatedFormData);
      // formData.crs = GcpData.crs
      const newWidgets = GcpData.control_points.map((feature, index) => {
        const { x, y, z = 0 } = feature; // Defaults Z to 0 if not present
        const color = rainbowColors[(index) % rainbowColors.length];
        return {
          color: color,
          id: index + 1, // Unique ID for widget
          coordinates: {x, y, z, row: "", col: ""},
          icon: createCustomMarker(color, index + 1)
        };

      });
      setWidgets(newWidgets);
      setNextId(newWidgets.length + 1);  // ensure the next ID is ready for a new XYZ widget

    } catch (error) {
      console.log("File loading not successful, do nothing...", error);
    }
  }
  const loadFile = async () => {
    try {
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
  }

    const handleFileChange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      setFileFormData({ file });
  }

  const validateWidgets = () => {
    // Check there are at least 6 widgets
    if (widgets.length < 6) return false;

    // Check that all required fields are valid for every widget
    return widgets.every(widget => {
      const { row, col, x, y, z } = widget.coordinates;
      return (
        row !== null && row !== '' &&
        col !== null && col !== '' &&
        x !== null && x !== '' &&
        y !== null && y !== '' &&
        z !== null && z !== ''
      );
    });
  };


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
                 accept=".geojson,.csv" onChange={handleFileChange} required/>
        </div>
          <button type='submit' className='btn'>
            Load control points
          </button>
        </form>

        <button
          onClick={() => fitGcps(api, widgets, imgDims, epsgCode, setWidgets, setMessageInfo)}
          className="btn"
          disabled={!validateWidgets()}
        >Validate</button>
        <div className='mb-3 mt-3'>
          <label htmlFor='crs' className='form-label small'>
            Coordinate reference system (only for GPS)
          </label>
          <input type='number' className='form-control' id='crs' name='crs' onChange={handleInputChange} value={formData.crs}/>
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
