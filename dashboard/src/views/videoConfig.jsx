import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import {run_video} from "../utils/apiCalls.jsx"
import RecipeForm from "./recipeComponents/recipeForm.jsx";
import {FaSave, FaTrash, FaPlay, FaSpinner, FaHourglass} from "react-icons/fa";
import CameraConfigForm from "./VideoConfigComponents/cameraConfigForm.jsx";
import PoseDetails from "./VideoConfigComponents/poseDetails.jsx";
import VideoConfigForm from "./VideoConfigComponents/VideoConfigForm.jsx";
import CrossSectionForm from "./VideoConfigComponents/crossSectionForm.jsx";
import SideView from "./VideoConfigComponents/sideView.jsx";
import TopView from "./VideoConfigComponents/topView.jsx";
import VideoTab from "./calibrationTabs/videoTab.jsx";
import CameraParameters from "./calibrationTabs/cameraParameters.jsx";
import {useMessage} from "../messageContext.jsx";

const VideoConfig = () => {
  const { videoId } = useParams(); // Retrieve the videoId from the URL
  const [video, setVideo] = useState(null); // Video metadata
  const [recipe, setRecipe] = useState(null); // Video metadata
  const [cameraConfig, setCameraConfigInstance] = useState(null); // Video metadata
  const [videoConfig, setVideoConfig] = useState(null);
  const [crossSection, setCrossSection] = useState({}); // Video metadata
  const [CSDischarge, setCSDischarge] = useState({}); // Video metadata
  const [CSWaterLevel, setCSWaterLevel] = useState({}); // Video metadata
  const [activeTab, setActiveTab] = useState('configDetails');
  const [activeView, setActiveView] = useState('camView');
  const {setMessageInfo} = useMessage();

  // consts for image clicking
  const [widgets, setWidgets] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState(null); // To track which widget is being updated
  const rotateState = useRef(cameraConfig?.rotation);
  const [imgDims, setImgDims] = useState(null);
  const [save, setSave] = useState(true);
  const [frameCount, setFrameCount] = useState(0);

  const setCameraConfig = (newConfig) => {
    const cameraConfigInstance = {
      ...newConfig,
      isCalibrated: function () {
        return (
          this.f !== null &&
          this.k1 !== null &&
          this.k2 !== null &&
          this.camera_position !== null &&
          this.camera_rotation !== null
        )
      },
      isPoseReady: function () {
        // check if camera config is ready for doing the camera pose
        return (
          this.name !== null &&
          this.id !== null
        )
      },
      isReadyForProcessing: function () {
        return (
          this.isCalibrated() &&
          this.isPoseReady() &&
          this.bbox !== null
        )
      }
    }

    setCameraConfigInstance(cameraConfigInstance);

  }

  // Fetch video metadata and existing configs when the component is mounted
  useEffect(() => {
    api.get(`/video/${videoId}/frame_count/`)
      .then((response) => {
        setFrameCount(response.data)
      })
      .catch((err) => console.error("Error fetching frame count:", err))
    api.get(`/video/${videoId}`)
      .then((response) => {
        setVideo(response.data);
        console.log("VIDEO INFO:", response.data);
        if (response.data.video_config !== null) {
          setVideoConfig({id: response.data.video_config.id, name: response.data.video_config.name})
          if (response.data.video_config.recipe !== null) {
            setRecipe(response.data.video_config.recipe);
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
        } else {
          createNewRecipe();  // if recipe exists it will be overwritten later
          createCameraConfig();  // if cam config exists, it will be overwritten later
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
  }, [widgets])

  useEffect(() => {
    // ensure user can save if any of the video config items changes
    setSave(true);
  }, [cameraConfig, recipe, CSDischarge, CSWaterLevel])

  useEffect(() => {
    // check if height and width of camera config must be adapted to a new rotation
    if (rotateState.current !== cameraConfig?.rotation && imgDims !== null && imgDims.height !== 0 && imgDims.width !== 0) {
      // set state to new
      rotateState.current = cameraConfig.rotation;
      const newConfig = {
        ...cameraConfig,
        height: imgDims.height,
        width: imgDims.width,
      }
      setCameraConfig(newConfig)
    }
  }, [imgDims])

  // if any cross section is set, make sure that the CS camera perspective is only provided when lens parameters are
  // complete
  useEffect(() => {
    if (cameraConfig && cameraConfig?.isCalibrated && !cameraConfig?.isCalibrated()) {
      if (CSDischarge !== null && CSDischarge?.camera_config !== null && Object.keys(CSWaterLevel).length > 0) {
        setCSDischarge({});
    }
      if (CSWaterLevel !== null && CSWaterLevel?.camera_config !== null && Object.keys(CSWaterLevel).length > 0) {
        setCSWaterLevel({});
      }

    }

  }, [cameraConfig, CSWaterLevel, CSDischarge])


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
    api.post(`/recipe/empty/`)
      .then((response) => {
        setRecipe({
          ...response.data,
          end_frame: frameCount
        });
      })
      .catch((error) => {
        console.error('Error occurred:', error);
      });

  }

  const deleteVideoConfig = async () => {
    const userConfirmed = window.confirm("Are you sure you want to delete this video configuration? This action is irreversible.");
    if (userConfirmed) {
      try {
        await api.delete(`/video_config/${videoConfig.id}/deps`); // remove video config including its dependencies
        setMessageInfo("success", "Video configuration deleted successfully.");
        setVideoConfig(null); // Reset the video configuration in the state
        createNewRecipe();  // if recipe exists it will be overwritten later
        createCameraConfig();  // if cam config exists, it will be overwritten later
        setCSDischarge({});
        setCSWaterLevel({});
        setActiveTab('configDetails');
        setActiveView('camView');

      } catch (error) {
        console.error("Error deleting video configuration:", error);
        setMessageInfo("error", "Failed to delete video configuration. Please try again later." );
      }
    }

  }


  // Helper function to render the appropriate icon for the video status
  const renderStatusIcon = (status) => {
    let icon, title, color
    switch (status) {
      case 2:
        icon = <FaHourglass size={20} />;
        title = "Video is queued";
        color = "purple";
        break;
      case 3:
        icon = <FaSpinner size={20} />;
        title = "Video is running";
        color = "blue";
        break;
      default:
        icon = <FaPlay size={20} />; // Default icon
        title = "Run selected video with configuration";
        color = '#3f9e28';
        break;
    }
    return <button
      type="button"
      title={title}
      style={{
        backgroundColor: 'transparent',
        border: 'none',
        cursor: videoConfig?.ready_to_run ? 'pointer' : 'not-allowed',
        color: color,
        padding: '5px'
      }}
      onClick={runVideo}
      disabled={!videoConfig?.ready_to_run}
    >
      {icon}
    </button>

  };
  const renderStatusTitle = (status) => {
    switch (status) {
      case 2:
        return "Video is queued";
      case 3:
        return "Video is running";
      default:
        return "Run selected video with configuration"; // Default icon
    }
  };


  const runVideo = async () => {
    run_video(video, setVideo, setMessageInfo);
  };

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
      const newConfig = {
        ...cameraConfig,
        gcps: {
          ...cameraConfig.gcps,
          z_0: null,
          h_ref: null,
          control_points: newWidgets.map(widget => widget.coordinates)
        },
        camera_position: null,
        camera_rotation: null,
        f: null,
        k1: null,
        k2: null,
        bbox_camera: [],
        bbox: [],
        data: {
          ...cameraConfig.data,
          bbox: null
        }

      }
      setCameraConfig(newConfig);
      setCSDischarge({});
      setCSWaterLevel({});
      // also remove selected cross sections
      return newWidgets;
    });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };


  return (
    <div style={{"position": "relative", "maxHeight": "100%", "display": "flex", "flexDirection": "column"}}>
      <h2>Video Configuration {video ? (video.id + ": " + video.timestamp) : (<p>Loading video...</p>)}</h2>
      <div className="split-screen flex">
        <div className="flex-container column no-padding">
        <div className="flex-container column" style={{"height": "100%"}}>
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px'}}>
            <h5 style={{margin: 0}}>Image view</h5>
          </div>
          <div className="tabs-row">
            <button
              className={activeView === 'camView' ? 'active-tab' : ''}
              onClick={(e) => {
                e.preventDefault();
                handleViewChange('camView');
              }}
            >
              Camera view
            </button>
            <button
              className={activeView === 'topView' ? 'active-tab' : ''}
              onClick={(e) => {
                e.preventDefault();
                handleViewChange('topView');
              }}
            >
              Top view
            </button>
          </div>

          {video && activeView === 'camView' && (
            <VideoTab
              video={video}
              frameNr={recipe?.start_frame}
              cameraConfig={cameraConfig}
              widgets={widgets}
              selectedWidgetId={selectedWidgetId}
              updateWidget={updateWidget}
              imgDims={imgDims}
              rotate={cameraConfig?.rotation || null}
              CSDischarge={CSDischarge}
              CSWaterLevel={CSWaterLevel}
              setCameraConfig={setCameraConfig}
              setSelectedWidgetId={setSelectedWidgetId}
              setImgDims={setImgDims}
            />
          )}
          {activeView === 'topView' && (
            <TopView
              CSDischarge={CSDischarge}
              CSWaterLevel={CSWaterLevel}
              Gcps={cameraConfig?.gcps?.control_points}
              cameraPosition={cameraConfig?.camera_position}
              rotation={cameraConfig?.camera_rotation ? cameraConfig?.camera_rotation[1] : 0}  // only down-pose rotation is needed
              bBox={cameraConfig?.bbox}
            />

          )}

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
                <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between'}}>
                <h5>Manage configuration</h5>
                  <div style={{display: 'flex', gap: '10px'}}>
                    <button
                      type="submit"
                      title={save ? "Save video configuration" : "No changes to save"}
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
                    {video && renderStatusIcon(video.status)}

                    <button
                      type="button"
                      title="Delete video configuration"
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#dc3545',
                        padding: '5px'
                      }}
                      onClick={deleteVideoConfig}
                    >
                      <FaTrash size={20}/>
                    </button>
                  </div>
                </div>
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
                    disabled={!cameraConfig?.isPoseReady()}
                  >
                    Camera pose
                  </button>
                  <button
                    className={activeTab === 'pose' ? 'active-tab' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange('pose');
                    }}
                    disabled={!cameraConfig?.isPoseReady()}
                  >
                    Camera pose 2
                  </button>
                  <button
                    className={activeTab === 'crossSection' ? 'active-tab' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange('crossSection');
                    }}
                    disabled={!cameraConfig?.isCalibrated()}
                  >
                    Cross sections
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

                  {activeTab === 'crossSection' &&
                    (
                      <CrossSectionForm
                        cameraConfig={cameraConfig}
                        crossSection={crossSection}
                        CSDischarge={CSDischarge}
                        CSWaterLevel={CSWaterLevel}
                        setCameraConfig={setCameraConfig}
                        setCrossSection={setCrossSection}
                        setCSDischarge={setCSDischarge}
                        setCSWaterLevel={setCSWaterLevel}
                        setMessageInfo={setMessageInfo}
                      />
                    )
                  }
                  {activeTab === 'pose' && (
                    <PoseDetails
                      cameraConfig={cameraConfig}
                      widgets={widgets}
                      selectedWidgetId={selectedWidgetId}
                      imgDims={imgDims}
                      updateWidget={updateWidget}
                      setCameraConfig={setCameraConfig}
                      setCSDischarge={setCSDischarge}
                      setCSWaterLevel={setCSWaterLevel}
                      setWidgets={setWidgets}
                      setSelectedWidgetId={setSelectedWidgetId}
                      setMessageInfo={setMessageInfo}
                    />
                  )}
                  {activeTab === 'recipe' &&
                    (
                      <RecipeForm
                        selectedRecipe={recipe}
                        setSelectedRecipe={setRecipe}
                        frameCount={frameCount}
                        setMessageInfo={setMessageInfo}
                        CSWaterLevel={CSWaterLevel}
                        CSDischarge={CSDischarge}
                      />
                    )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex-container column no-padding" style={{"maxHeight": "40%", "overflowY": "hidden"}}>
            <div className="flex-container column" style={{
              "height": "100%",
              "overflowY": "hidden",
              "overflowX": "hidden"
            }}>
                  <h5>Side view</h5>
                      <SideView
                        CSDischarge={CSDischarge}
                        CSWaterLevel={CSWaterLevel}
                        recipe={recipe}
                        cameraConfig={cameraConfig}
                      />
                  </div>
                </div>
              </div>
            </div>
    </div>
  );
};

export default VideoConfig;
