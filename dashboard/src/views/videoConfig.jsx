import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import MessageBox from "../messageBox.jsx";
import RecipeForm from "./recipeComponents/recipeForm.jsx";
import CameraConfigForm from "./VideoConfigComponents/cameraConfigForm.jsx";
import VideoConfigForm from "./VideoConfigComponents/VideoConfigForm.jsx";
import {useMessage} from "../messageContext.jsx";

const VideoConfig = () => {
  const { videoId } = useParams(); // Retrieve the videoId from the URL
  const [video, setVideo] = useState(null); // Video metadata
  const [recipe, setRecipe] = useState(null); // Video metadata
  const [cameraConfig, setCameraConfig] = useState(null); // Video metadata
  const [videoConfig, setVideoConfig] = useState(null);
  const [CSDischarge, setCSDischarge] = useState({}); // Video metadata
  const [CSWaterLevel, setCSWaterLevel] = useState({}); // Video metadata
  const [activeTab, setActiveTab] = useState('configDetails');
  const {setMessageInfo} = useMessage();

  // Fetch video metadata and existing configs when the component is mounted
  useEffect(() => {
    api.get(`/video/${videoId}`)
      .then((response) => {
        createNewRecipe();  // if recipe exists it will be overwritten later
        createCameraConfig();  // if cam config exists, it will be overwritten later
        setVideo(response.data);
        console.log(response.data);
        if (response.data.video_config !== null) {
          setVideoConfig({id: response.data.video_config.id, name: response.data.video_config.name})
          if (response.data.video_config.recipe) {
            setRecipe(response.data.video_config.recipe);
          }
          if (response.data.camera_config) {
            setCameraConfig(response.data.camera_config);
          }
          setCSDischarge(response.data.video_config.cross_section)
          setCSWaterLevel(response.data.video_config.cross_section_wl)
        }
      })
      .catch((err) => console.error("Error fetching video data:", err));

  }, [videoId]);

  const createCameraConfig = () => {
    api.get(`/camera_config/empty/${videoId}`) // Replace with your API endpoint
      .then((response) => {
        setCameraConfig(response.data);
      })
      .catch((error) => {
        console.error('Error occurred:', error);
      });

  }

  const createNewRecipe = () => {
    api.post(`/recipe/empty/`) // Replace with your API endpoint
      .then((response) => {
        setRecipe(response.data);
      })
      .catch((error) => {
        console.error('Error occurred:', error);
      });

  }

  // // Function for creating a new config
  // const createNewConfig = (configName) => {
  //   if (!configName.trim()) {
  //     alert("Config name cannot be empty!");
  //     return;
  //   }
  //   api.post("/video-config/", { video_id: videoId, config_name: configName })
  //     .then((res) => {
  //       alert("Config created successfully!");
  //       setExistingConfigs([...existingConfigs, res.data]); // Add the new config
  //     })
  //     .catch((error) => console.error("Error creating config:", error));
  // };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div style={{"position": "relative", "maxHeight": "100%", "display": "flex", "flexDirection": "column"}}>
      <h2>Video Configuration {video ? (video.id + ": " + video.timestamp) : (<p>Loading video...</p>)}</h2>
      <div className="split-screen">
        <div className="flex-container column">
          <h5>Image view</h5>
          <p> Placeholder for video </p>
          {video ? (
            <div>
              <p><strong>Timestamp:</strong> {video.timestamp}</p>
              {/* Add any other video-specific details */}
            </div>
          ) : (
            <p>Loading video details...</p>
          )}
        </div>
        <div className="flex-container column">
          <div className="tabbed-form-container">
            <MessageBox/>
            <div className="tabs-header">
            <h5>Manage configuration</h5>

            {/* Tabs row */}
            <div className="tabs-row">
              <button
                className={activeTab === 'configDetails' ? 'active-tab' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  handleTabChange('configDetails');
                }}
              >
                Name + details
              </button>
              <button
                className={activeTab === 'gcps' ? 'active-tab' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  handleTabChange('gcps');
                }}
              >
                Camera pose
              </button>
              <button
                className={activeTab === 'recipe' ? 'active-tab' : ''}
                onClick={(e) => {
                  e.preventDefault();
                  handleTabChange('recipe');
                }}
              >
                Processing
              </button>

            </div>
            </div>
            <div className="tab-container">
              {/* Tab content */}
              <div className="tab-content">
                {activeTab === 'configDetails' && (
                  <VideoConfigForm
                    selectedVideoConfig={videoConfig}
                    setSelectedVideoConfig={setVideoConfig}
                    cameraConfig={cameraConfig}
                    recipe={recipe}
                    CSDischarge={CSDischarge}
                    CSWaterLevel={CSWaterLevel}
                    setMessageInfo={setMessageInfo}
                  />
                )}

                {activeTab === 'gcps' && (
                  <CameraConfigForm
                    selectedCameraConfig={cameraConfig}
                    setSelectedCameraConfig={setCameraConfig}
                    setMessageInfo={setMessageInfo}
                  />
                )}
                {activeTab === 'recipe' &&
                  (
                    <RecipeForm
                      selectedRecipe={recipe}
                      setSelectedRecipe={setRecipe}
                      setMessageInfo={setMessageInfo}
                    />
                  )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoConfig;
