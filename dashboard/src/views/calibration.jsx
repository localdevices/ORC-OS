import React, { useState } from 'react';
import ControlPointsTab from './calibrationTabs/controlPointsTab'
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
            Video
          </button>
          <button
            className={activeTab === 'controlPoints' ? 'active-tab' : ''}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('controlPoints');
            }}
          >
            Control Points
          </button>
          <button
            className={activeTab === 'recipe' ? 'active-tab' : ''}
            onClick={(e) => {
              e.preventDefault();
              handleTabChange('recipe');
            }}
          >
            Recipe
          </button>
        </div>

        {/* Tab content */}
        <div className="tab-content">
          {activeTab === 'video' && (
            <div>
              <label>Video URL</label>
              <input
                type="text"
                value={formData.video}
                onChange={(e) => handleInputChange('video', e.target.value)}
              />
            </div>
          )}
          {activeTab === 'controlPoints' && (
              <ControlPointsTab
              />
          )}
          {activeTab === 'recipe' && (
            <div>
              <label>Recipe Details</label>
              <textarea
                value={formData.recipe}
                onChange={(e) =>
                  handleInputChange('recipe', e.target.value)
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