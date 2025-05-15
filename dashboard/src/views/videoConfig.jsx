import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import MessageBox from "../messageBox.jsx";
import RecipeForm from "./recipeComponents/recipeForm.jsx";
import CameraConfigForm from "./VideoConfigComponents/cameraConfigForm.jsx";
import PoseDetails from "./VideoConfigComponents/poseDetails.jsx";
import VideoConfigForm from "./VideoConfigComponents/VideoConfigForm.jsx";
import CrossSectionForm from "./VideoConfigComponents/crossSectionForm.jsx";
import CrossSectionDisplay from "./VideoConfigComponents/crossSectionDisplay.jsx";
import VideoTab from "./calibrationTabs/videoTab.jsx";
import CameraParameters from "./calibrationTabs/cameraParameters.jsx";
import {useMessage} from "../messageContext.jsx";
import {createCustomMarker} from "../utils/leafletUtils.js";

const VideoConfig = () => {
  const { videoId } = useParams(); // Retrieve the videoId from the URL
  const [video, setVideo] = useState(null); // Video metadata
  const [recipe, setRecipe] = useState(null); // Video metadata
  const [cameraConfig, setCameraConfig] = useState(null); // Video metadata
  const [videoConfig, setVideoConfig] = useState(null);
  const [crossSection, setCrossSection] = useState({}); // Video metadata
  const [CSDischarge, setCSDischarge] = useState({}); // Video metadata
  const [CSWaterLevel, setCSWaterLevel] = useState({}); // Video metadata
  const [activeTab, setActiveTab] = useState('configDetails');
  const {setMessageInfo} = useMessage();

  // consts for image clicking
  const [widgets, setWidgets] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState(null); // To track which widget is being updated
  const [nextId, setNextId] = useState(1);  // widget ids increment automatically
  const [dots, setDots] = useState({}); // Array of { x, y, id } objects
  const [GCPsVisible, setGCPsVisible] = useState(false); // State to toggle GCP menu right-side
  const [imgDims, setImgDims] = useState(null);


  // Fetch video metadata and existing configs when the component is mounted
  useEffect(() => {
    createNewRecipe();  // if recipe exists it will be overwritten later
    createCameraConfig();  // if cam config exists, it will be overwritten later

    api.get(`/video/${videoId}`)
      .then((response) => {
        setVideo(response.data);
        console.log(response.data);
        if (response.data.video_config !== null) {
          setVideoConfig({id: response.data.video_config.id, name: response.data.video_config.name})
          if (response.data.video_config.recipe !== null) {
            console.log("RECIPE DATA FOUND")
            setRecipe(response.data.video_config.recipe);
          } else {
            console.log("RECIPE DATA NOT FOUND in ", response.data)

          }
          if (response.data.video_config.camera_config) {
            setCameraConfig(response.data.video_config.camera_config);
          }
          if (response.data.video_config.cross_section) {
            setCSDischarge(response.data.video_config.cross_section)
          }
          if (response.data.video_config.cross_section_wl) {
            setCSWaterLevel(response.data.video_config.cross_section_wl)
          }
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

  const addWidget = () => {
    setWidgets((prevWidgets) => {
      const color = rainbowColors[(nextId - 1) % rainbowColors.length];
      return [
        ...prevWidgets,
        {
          id: nextId,
          color: color,
          coordinates: { x: '', y: '', z:'', row: '', col: ''},
          icon: createCustomMarker(color, nextId)
        },
      ]
    });
    setNextId((prevId) => prevId + 1); // increment the unique id for the next widget
  };

  const updateWidget = (id, updatedCoordinates) => {

    setWidgets((prevWidgets) =>
      prevWidgets.map((widget) =>
        widget.id === id ? {...widget, coordinates: updatedCoordinates } : widget
      )
    );
  };

  const deleteWidget = (id) => {
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
  }

  return (
    <div style={{"position": "relative", "maxHeight": "100%", "display": "flex", "flexDirection": "column"}}>
      <h2>Video Configuration {video ? (video.id + ": " + video.timestamp) : (<p>Loading video...</p>)}</h2>
      <MessageBox/>
      <div className="split-screen flex">
        <div className="flex-container column no-padding">
        <div className="flex-container column" style={{"height": "100%"}}>
          <h5>Image view</h5>
          <VideoTab
            video={video}
            widgets={widgets}
            selectedWidgetId={selectedWidgetId}
            updateWidget={updateWidget}
            dots={dots}
            imgDims={imgDims}
            setDots={setDots}
            setImgDims={setImgDims}
          />

        </div>
          <CameraParameters/>
        </div>
        <div className="flex-container column no-padding">
          <div className="flex-container column" style={{"height": "60%"}}>
            <div className="tabbed-form-container">
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
                    className={activeTab === 'pose' ? 'active-tab' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange('pose');
                    }}
                  >
                    Camera pose 2
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
                  <button
                    className={activeTab === 'crossSection' ? 'active-tab' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange('crossSection');
                    }}
                  >
                    Cross sections
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
                      video={video}
                      cameraConfig={cameraConfig}
                      recipe={recipe}
                      CSDischarge={CSDischarge}
                      CSWaterLevel={CSWaterLevel}
                      setCameraConfig={setCameraConfig}
                      setRecipe={setRecipe}
                      setCSDischarge={setCSDischarge}
                      setCSWaterLevel={setCSWaterLevel}
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

                  {activeTab === 'pose' && (
                    <PoseDetails
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
                  {activeTab === 'crossSection' &&
                    (
                      <CrossSectionForm
                        crossSection={crossSection}
                        CSDischarge={CSDischarge}
                        CSWaterLevel={CSWaterLevel}
                        setCrossSection={setCrossSection}
                        setCSDischarge={setCSDischarge}
                        setCSWaterLevel={setCSWaterLevel}
                        setMessageInfo={setMessageInfo}
                      />
                    )
                  }
                </div>
              </div>
            </div>
          </div>
          <div className="flex-container column" style={{"flexGrow": "0", "minHeight": "30%", "overflowY": "auto", "overflowX": "hidden"}}>
            <h5>Cross sections</h5>
              <CrossSectionDisplay
                CSDischarge={CSDischarge}
                CSWaterLevel={CSWaterLevel}
              />
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoConfig;
