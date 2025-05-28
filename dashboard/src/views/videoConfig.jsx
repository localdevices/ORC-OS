import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import MessageBox from "../messageBox.jsx";
import RecipeForm from "./recipeComponents/recipeForm.jsx";
import {FaSave} from "react-icons/fa";
import CameraConfigForm from "./VideoConfigComponents/cameraConfigForm.jsx";
import PoseDetails from "./VideoConfigComponents/poseDetails.jsx";
import VideoConfigForm from "./VideoConfigComponents/VideoConfigForm.jsx";
import CrossSectionForm from "./VideoConfigComponents/crossSectionForm.jsx";
import CrossSectionDisplay from "./VideoConfigComponents/crossSectionDisplay.jsx";
import VideoTab from "./calibrationTabs/videoTab.jsx";
import CameraParameters from "./calibrationTabs/cameraParameters.jsx";
import {useMessage} from "../messageContext.jsx";

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
  const [dots, setDots] = useState({}); // Array of { x, y, id } objects
  const rotateState = useRef(cameraConfig?.rotation);
  const [cameraConfigState, setCameraConfigState] = useState({
    coordinates: [],
    fittedCoordinates: [],
  }); // central controls camera config
  const [imgDims, setImgDims] = useState(null);
  const [save, setSave] = useState(true);


  // Fetch video metadata and existing configs when the component is mounted
  useEffect(() => {
    createNewRecipe();  // if recipe exists it will be overwritten later
    createCameraConfig();  // if cam config exists, it will be overwritten later

    api.get(`/video/${videoId}`)
      .then((response) => {
        setVideo(response.data);
        if (response.data.video_config !== null) {
          setVideoConfig({id: response.data.video_config.id, name: response.data.video_config.name})
          if (response.data.video_config.recipe !== null) {
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
      .catch((err) => console.error("Error fetching video data:", err))
      .finally(() => {
        setSave(false)

      });

  }, [videoId]);

  useEffect(() => {
    // make sure that if a selected widget can no longer be found, the selected id is reset to null
    if (selectedWidgetId && !widgets.find(w => w.id === selectedWidgetId)) {
      setSelectedWidgetId(null);
    }
  }, [widgets, selectedWidgetId])

  useEffect(() => {
    setSave(true);
  }, [cameraConfig, recipe, CSDischarge, CSWaterLevel])

  useEffect(() => {
    // check if height and width must be adapted to a new rotation
    if (rotateState.current !== cameraConfig?.rotation && imgDims !== null) {
      // set state to new
      rotateState.current = cameraConfig.rotation;
      setCameraConfig((prevConfig) => (
        {
          ...prevConfig,
          height: imgDims.height,
          width: imgDims.width
        })
      )
    }
  }, [imgDims])


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

  const updateWidget = (id, updatedCoordinates) => {
    setWidgets((prevWidgets) => {
      const newWidgets = prevWidgets.map((widget) =>
        widget.id === id
          ? {
              ...widget,
              coordinates: {
                ...updatedCoordinates,
                x: parseFloat(updatedCoordinates.x) || null,
                y: parseFloat(updatedCoordinates.y) || null,
                z: parseFloat(updatedCoordinates.z) || null,
                row: parseFloat(updatedCoordinates.row) || null,
                col: parseFloat(updatedCoordinates.col) || null,

            }
          } : widget
      );

      // Update cameraConfig with new coordinates
      setCameraConfig((prevConfig) => ({
        ...prevConfig,
        gcps: {
          ...prevConfig.gcps,
          control_points: newWidgets.map(widget => widget.coordinates)
        }
      }));

      return newWidgets;
    });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };


  return (
    <div style={{"position": "relative", "maxHeight": "100%", "display": "flex", "flexDirection": "column"}}>
      <h2>Video Configuration {video ? (video.id + ": " + video.timestamp) : (<p>Loading video...</p>)}</h2>
      <MessageBox/>
      <div className="split-screen flex">
        <div className="flex-container column no-padding">
        <div className="flex-container column" style={{"height": "100%"}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px'}}>
            <h5 style={{margin: 0}}>Image view</h5>
            <button
              type="submit"
              form="videoConfigForm"
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: save ? 'pointer' : 'not-allowed',
                color: save ? '#0d6efd' : '#6c757d',
                padding: '5px'
              }}
              disabled={!save}
            >
              <FaSave size={20}/>
            </button>
          </div>

          <VideoTab
            video={video}
            widgets={widgets}
            selectedWidgetId={selectedWidgetId}
            updateWidget={updateWidget}
            dots={dots}
            imgDims={imgDims}
            rotate={cameraConfig?.rotation || null}
            setDots={setDots}
            setImgDims={setImgDims}
          />

        </div>
          <CameraParameters
            cameraConfig={cameraConfig}
            setCameraConfig={setCameraConfig}
          />
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
                  <div style={{ display: activeTab === 'configDetails' ? 'block' : 'none' }}>

                  {/*{activeTab === 'configDetails' && (*/}
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
                      setSave={setSave}
                      setMessageInfo={setMessageInfo}
                    />
                    </div>
                  {/*)}*/}

                  {activeTab === 'gcps' && (
                    <CameraConfigForm
                      selectedCameraConfig={cameraConfig}
                      setSelectedCameraConfig={setCameraConfig}
                      setMessageInfo={setMessageInfo}
                    />
                  )}

                  {activeTab === 'pose' && (
                    <PoseDetails
                      cameraConfig={cameraConfig}
                      widgets={widgets}
                      dots={dots}
                      selectedWidgetId={selectedWidgetId}
                      imgDims={imgDims}
                      updateWidget={updateWidget}
                      setCameraConfig={setCameraConfig}
                      setWidgets={setWidgets}
                      setDots={setDots}
                      setSelectedWidgetId={setSelectedWidgetId}
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
