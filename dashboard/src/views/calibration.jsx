import React, { useState } from 'react';
import VideoTab from './calibrationTabs/videoTab'
import './calibration.css'; // Ensure the styles reflect the updated layout.

const Calibration = () => {
  const [activeTab, setActiveTab] = useState('video');
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
    alert('Form submitted successfully!');
  };

  return (
    <div className="tabbed-form-container">
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