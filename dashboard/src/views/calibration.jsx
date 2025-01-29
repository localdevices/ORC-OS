import React, { useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useMessage } from '../messageContext';
import MessageBox from '../messageBox';
import VideoTab from './calibrationTabs/videoTab'
import XYZWidget from './calibrationTabs/XyzWidget';
import MapTab from './calibrationTabs/mapTab';
import api from '../api';

import '../nav/Navbar.css'
import './calibration.css'; // Ensure the styles reflect the updated layout.
import { createCustomMarker } from '../utils/leafletUtils';
import { fitGcps } from '../utils/apiCalls';


const Calibration = () => {
  const [activeTab, setActiveTab] = useState('video');
  const [fileError, setFileError] = useState(null); // Error state for file
  const [widgets, setWidgets] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState(null); // To track which widget is being updated
  const [nextId, setNextId] = useState(1);  // widget ids increment automatically
  const [dots, setDots] = useState([]); // Array of { x, y, id } objects
  const [GCPsVisible, setGCPsVisible] = useState(false); // State to toggle GCP menu right-side
  const [epsgCode, setEpsgCode] = useState(4326);
  const mapIsVisible = activeTab === "map"; // Check Map Tab visibility
  const [formData, setFormData] = useState({
    video: '',
    controlPoints: '',
    recipe: '',
  });

  // allow for setting messages
  const { setMessageInfo } = useMessage();

  // make some colors
  const rainbowColors = Array.from({ length: 10 }, (_, i) => {
    const hue = (i / 10) * 360; // Distributes hues evenly across 360 degrees
    return `hsl(${hue}, 100%, 50%)`;
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleInputChange = (tab, value) => {
    setFormData((prev) => ({
      ...prev,
      [tab]: value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  const addWidget = () => {
    setWidgets((prevWidgets) => {
      const color = rainbowColors[(nextId -1) % rainbowColors.length];
      return [
        ...prevWidgets,
        {
          id: nextId,
          color: color,
          coordinates: { x: '', y: '', z: '', row: '', col: '' },
          icon: createCustomMarker(color)
        },
    ]});
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
    setDots((prevDots) => {
      // Copy the previous state object
      const newDots = { ...prevDots };
      delete newDots[id];
      return newDots;
    });

  };

  // remove all existing widgets
  const clearWidgets = () => {
    setWidgets([]);
    setDots([]);
  }
// Toggles the right menu
  const toggleMenu = () => {
    setGCPsVisible((prev) => !prev);
  };
  // Detects clicks outside the menu and closes it
  const handleBackgroundClick = (e) => {
    if (menuVisible) {
      setMenuVisible(false);
    }
  };

  // Function to handle file upload and processing
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (!file) {
      setFileError("No file selected.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const geojson = JSON.parse(e.target.result);

        // Validate the GeoJSON structure
        if (geojson.type !== "FeatureCollection") {
          setFileError("Invalid GeoJSON: Must be of type 'FeatureCollection'.");
          return;
        }

        // Ensure all geometries are of type 'Point'
        const features = geojson.features || [];
        const points = features.filter(
          (feature) => feature.geometry?.type === "Point"
        );

        if (points.length !== features.length) {
          setFileError(
            "Invalid GeoJSON: All features must contain 'Point' geometries."
          );
          return;
        }

        // Parse EPSG code
        const geoEpsgCode = geojson?.epsgCode || epsgCode;
        setEpsgCode(geoEpsgCode);

        // Clear existing widgets before adding new ones
        clearWidgets();

        // Parse coordinates and create new widgets
        const newWidgets = points.map((feature, index) => {
          const [x, y, z = 0] = feature.geometry.coordinates; // Defaults Z to 0 if not present
          const color = rainbowColors[(index) % rainbowColors.length];
          return {
            color: color,
            id: index + 1, // Unique ID for widget
            coordinates: { x, y, z, row: "", col: "" },
            icon: createCustomMarker(color)
          };
        });

        setWidgets(newWidgets);
        setFileError(null); // Clear error state
      } catch (err) {
        setFileError("Failed to parse GeoJSON: Invalid file format.");
      }
    };

    reader.onerror = () => {
      setFileError("An error occurred while reading the file.");
    };

    reader.readAsText(file);
  };



  return (
    <div className="tabbed-form-container">
    <MessageBox />
    {GCPsVisible && <div className="sidebar-overlay" onClick={toggleMenu}></div>}
      <h1>Camera calibration</h1>

        {/* Tabs row */}
        <div className="tabs-row">
          <button
            className={activeTab === 'video' ? 'active-tab' : ''}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('video');
            }}
          >
            Video view
          </button>
          <button
            className={activeTab === 'threed' ? 'active-tab' : ''}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('threed');
            }}
          >
            3D View
          </button>
          <button
            className={activeTab === 'map' ? 'active-tab' : ''}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('map');
            }}
          >
            Map View
          </button>
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {activeTab === 'video' && (
              <VideoTab
                widgets={widgets}
                selectedWidgetId={selectedWidgetId}
                updateWidget={updateWidget}
                dots={dots}
                setDots={setDots}
              />
          )}
          {activeTab === 'threed' && (
            <div>
              <label>3D view</label>
              <input
                type="text"
                value={formData.threed}
                onChange={(e) => handleInputChange('threed', e.target.value)}
              />
            </div>
          )}
          {activeTab === 'map' &&
              (
            <MapTab
              epsgCode={epsgCode}
              widgets={widgets}
              selectedWidgetId={selectedWidgetId}
              updateWidget={updateWidget}
              mapIsVisible={activeTab === 'map'}
            />
          )}
        </div>
      {/* Right-side button to toggle the menu */}
      <button
        onClick={toggleMenu}
        style={{
          position: 'fixed',
          right: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1060,
          backgroundColor: '#333',
          color: 'white',
          padding: '10px',
          borderRadius: '5px 0 0 5px',
          cursor: 'pointer',
          border: 'none',
          fontSize: '18px',
        }}
      >
        {GCPsVisible ? <FaChevronRight /> : <FaChevronLeft />}
      </button>
      {/* Sliding menu (right tabs column) */}
      <div className={`sidebar-right ${GCPsVisible ? 'visible' : 'hidden'}`}>
      <a className='navbar-brand' href="#">
        <img src="./public/orc_favicon.svg" alt="ORC Logo" width="30" height="30" className="d-inline-block align-text-top"/>
        {' '} GCPs
      </a>
      <hr/>
      <div>
        {/* File Upload Button */}
        <input
          type="file"
          accept=".geojson"
          onChange={handleFileUpload}
          style={{ marginBottom: "1rem" }}
        />

        {/* Error Message */}
        {fileError && <div style={{ color: "red" }}>{fileError}</div>}

        {/* CRS Input */}
        <div style={{ marginBottom: '1rem' }}>
          <label htmlFor="epsgCode" style={{ marginRight: '10px' }}>Coordinate reference system (e.g. EPSG code or Proj4 string):</label>
          <input
            type="text"
            id="epsgCode"
            value={epsgCode}
            onChange={(e) => setEpsgCode(e.target.value)}
            placeholder="4326"
            style={{ width: '300px' }}
          />
        </div>
          <button onClick={addWidget} className="active-tab">Add GCP</button>
          <button onClick={() => fitGcps(api, widgets, setWidgets, setMessageInfo)} className="active-tab">Fit GCPs</button>
          {widgets.map((widget) => (
            <div key={widget.id} onClick={(event) =>
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
                onDelete={deleteWidget}
              />
            </div>
          ))}
      </div>
      </div>


      {/* Submit button section */}
      <div className="form-actions">
        <button type="submit" className="btn" onClick={handleSubmit}>
          Submit
        </button>
      </div>
    </div>
  );
};

export default Calibration;