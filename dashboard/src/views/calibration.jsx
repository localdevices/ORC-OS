import React, { useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import VideoTab from './calibrationTabs/videoTab'
import XYZWidget from './calibrationTabs/XyzWidget';
import '../nav/Navbar.css'
import './calibration.css'; // Ensure the styles reflect the updated layout.

const Calibration = () => {
  const [activeTab, setActiveTab] = useState('video');
  const [widgets, setWidgets] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState(null); // To track which widget is being updated
  const [nextId, setNextId] = useState(1);  // widget ids increment automatically
  const [dots, setDots] = useState([]); // Array of { x, y, id } objects
  const [GCPsVisible, setGCPsVisible] = useState(false); // State to toggle GCP menu right-side


  const [formData, setFormData] = useState({
    video: '',
    controlPoints: '',
    recipe: '',
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
    console.log(dots.filter);
    // also delete the dot
    setDots((prevDots) => {
      // Copy the previous state object
      const newDots = { ...prevDots };
      delete newDots[id];
      return newDots;
    });

  };

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


  return (
    <div className="tabbed-form-container">
    {GCPsVisible && <div className="sidebar-overlay" onClick={toggleMenu}></div>}
      <h1>Camera calibration</h1>

      {/* Form container */}
      <form onSubmit={handleSubmit} className="tabbed-layout">
        {/* Tabs column */}
        <div className="tabs-column">
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
          {activeTab === 'map' && (
            <div>
              <label>Map view</label>
              <textarea
                value={formData.map}
                onChange={(e) =>
                  handleInputChange('map', e.target.value)
                }
              ></textarea>
            </div>
          )}
        </div>
      </form>
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
      <div>
{/*       <div className="tabs-column" style={{width:"300px"}}> */}
{/*       <div style={{ flex: 1 }}> */}

          <button onClick={addWidget} className="active-tab">Add GCP</button>
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