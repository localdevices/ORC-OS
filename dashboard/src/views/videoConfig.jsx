import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import api, {createWebSocketConnection, closeWebSocketConnection} from "../api/api.js";
import {run_video} from "../utils/apiCalls/video.jsx";
import {deepMerge} from "../utils/deepMerge.js";
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
  const hasRequestedResetRef = useRef(false);
  const ws = useRef(null);
  const wsConnectionIdRef = useRef(null);
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

  // constants for image clicking
  const [widgets, setWidgets] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState(null); // To track which widget is being updated
  const rotateState = useRef(cameraConfig?.rotation);
  const [imgDims, setImgDims] = useState(null);
  const [save, setSave] = useState(true);
  const [frameCount, setFrameCount] = useState(0);

  // Helper to add instance methods to a camera config object
  const enhanceCameraConfig = (config) => {
    if (config == null) return config; // allow null to pass through
    return {
      ...config,
      isCalibrated: function () {
        return (
          this.f !== null &&
          this.k1 !== null &&
          this.k2 !== null &&
          this.camera_position !== null &&
          this.camera_rotation !== null
        );
      },
      isPoseReady: function () {
        // check if camera config is ready for doing the camera pose
        return (
          this.name !== null &&
          this.id !== null
        );
      },
      isReadyForProcessing: function () {
        return (
          this.isCalibrated() &&
          this.isPoseReady() &&
          this.bbox !== null
        );
      },
    };
  };

  // Wrapper that behaves like a normal React setState setter
  const setCameraConfig = (update) => {
    if (typeof update === "function") {
      // Functional updater form: setCameraConfig(prev => next)
      setCameraConfigInstance((prev) => {
        const next = update(prev);
        return enhanceCameraConfig(next);
      });
    } else {
      // Direct value form: setCameraConfig(nextValue)
      setCameraConfigInstance(enhanceCameraConfig(update));
    }
  };
  // const setCameraConfig = (newConfig) => {
  //   const cameraConfigInstance = {
  //     ...newConfig,
  //     isCalibrated: function () {
  //       return (
  //         this.f !== null &&
  //         this.k1 !== null &&
  //         this.k2 !== null &&
  //         this.camera_position !== null &&
  //         this.camera_rotation !== null
  //       )
  //     },
  //     isPoseReady: function () {
  //       // check if camera config is ready for doing the camera pose
  //       return (
  //         this.name !== null &&
  //         this.id !== null
  //       )
  //     },
  //     isReadyForProcessing: function () {
  //       return (
  //         this.isCalibrated() &&
  //         this.isPoseReady() &&
  //         this.bbox !== null
  //       )
  //     }
  //   }
  //   setCameraConfigInstance(cameraConfigInstance);
  // }

  // Fetch video metadata and existing configs when the component is mounted
  useEffect(() => {
    const fetchFrameCountAndVideo = async (videoId) => {
      api.get(`/video/${videoId}/frame_count/`)
        .then((response) => {
          const updatedFrameCount = response.data;
          setFrameCount(updatedFrameCount);
          const connectionId = `wsVideo_${videoId}`
          wsConnectionIdRef.current = connectionId
          // open websocket connection with video with video_config instance
          const wsCur = createWebSocketConnection(
            connectionId,
            `/video/${videoId}/video_ws/`,
            callbackVideoStates
          );
          ws.current = wsCur;
          // api.get(`/video/${videoId}/`)
          //   .then((response) => {
          //     setVideo(response.data);
          //     if (response.data.video_config !== null) {
          //       setVideoConfig({
          //         id: response.data.video_config.id,
          //         name: response.data.video_config.name,
          //         sync_status: response.data.video_config.sync_status,
          //         sample_video_id: response.data.video_config.sample_video_id
          //       })
          //       if (response.data.video_config.recipe !== null) {
          //         setRecipe(response.data.video_config.recipe);
          //       }
          //       if (response.data.video_config.camera_config) {
          //         setCameraConfig(response.data.video_config.camera_config);
          //       }
          //       if (response.data.video_config.cross_section) {
          //         setCSDischarge(response.data.video_config.cross_section)
          //       }
          //       if (response.data.video_config.cross_section_wl) {
          //         setCSWaterLevel(response.data.video_config.cross_section_wl)
          //       }
          //     } else {
          //       createNewRecipe(updatedFrameCount);  // if the recipe exists, it will be overwritten later
          //       createCameraConfig();  // if cam config exists, it will be overwritten later
          //     }
          //   })
          //   .catch(err => console.error("Error fetching video data:", err))
        })
        .catch((err) => console.error("Error fetching frame count:", err))
        .finally(() => {
          // setSave(false)
        });
    };
    fetchFrameCountAndVideo(videoId).then(r => {return r});

    // cleanup when videoId change or component unmounts
    return () => {
      if (wsConnectionIdRef.current) {
        closeWebSocketConnection(
          wsConnectionIdRef.current,
          1000,
          "Navigating away from VideoConfig view"
        );
        wsConnectionIdRef.current = null;
        ws.current = null;
      }
    }
  }, [videoId]);

  useEffect(() => {
    // make sure that if a selected widget can no longer be found, the selected id is reset to null
    if (selectedWidgetId && !widgets.find(w => w.id === selectedWidgetId)) {
      setSelectedWidgetId(null);
    }
  }, [widgets])

  // useEffect(() => {
  //   // ensure the user can save if any of the video config items changes
  //   setSave(true);
  // }, [cameraConfig, recipe, CSDischarge, CSWaterLevel])

  // useEffect(() => {
  //   // check if the height and width of camera config must be adapted to a new rotation
  //   if (rotateState.current !== cameraConfig?.rotation && imgDims !== null && imgDims.height !== 0 && imgDims.width !== 0) {
  //     // set state to new
  //     rotateState.current = cameraConfig.rotation;
  //     const newConfig = {
  //       ...cameraConfig,
  //       height: imgDims.height,
  //       width: imgDims.width,
  //     }
  //     setCameraConfig(newConfig)
  //   }
  // }, [imgDims])

  // if any cross-section is set, make sure that the CS camera perspective is only provided when lens parameters are
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

  const callbackVideoStates = (wsResponse, ws) => {
    // define what should happen with wsResponse once onmessage passes by
    // report save state
    if (wsResponse.saved !== undefined) {
      setSave(!wsResponse.saved);
    }
    // figure out what was returned, video, video_config, recipe, camera_config, cross_section, cross_section_wl
    if (wsResponse.video) {
      // console.log("video received!", wsResponse.video);
      // set and/or patch entire video
      setVideo(prevVideo =>
        // console.log("combine with existing video:", prevVideo);
        deepMerge(prevVideo, wsResponse.video)
      );
    }
    if (wsResponse.video?.video_config) {
      const patchVideoConfig = wsResponse.video.video_config;
      setVideoConfig(prevVideoConfig => {
        // console.log("Patching video config:", prevVideoConfig, patchVideoConfig)
        const merged = deepMerge(prevVideoConfig, wsResponse.video.video_config)
        // console.log("video config update", prevVideoConfig, patchVideoConfig, merged);
        return merged;
      });
      hasRequestedResetRef.current = false;
      // check subcomponents nested
      if (patchVideoConfig.recipe) {
        setRecipe(prevRecipe => deepMerge(prevRecipe, patchVideoConfig.recipe));
      }
      if (patchVideoConfig.camera_config) {
        setCameraConfig(prevCameraConfig => {
          const merged = deepMerge(prevCameraConfig, wsResponse.video.video_config.camera_config)
          // console.log("camconfig update", prevCameraConfig, wsResponse.video.video_config.camera_config, merged);
          return merged;
        });
      }
      if (patchVideoConfig.cross_section) {
        setCSDischarge(prevCSDischarge => deepMerge(prevCSDischarge, patchVideoConfig.cross_section));
      }
      if (patchVideoConfig.cross_section_wl) {
        setCSWaterLevel(prevCSWaterLevel => deepMerge(prevCSWaterLevel, patchVideoConfig.cross_section_wl));
      }
    } else {
      // check if there is no video_config set, if so a new one must be created
      if (!hasRequestedResetRef.current && ws) {
        // a new recipe and camera config are needed, reset states to create new ones
        hasRequestedResetRef.current = true;
        console.log("RESETTING video config");
        ws.sendJson({"action": "reset_video_config"})
      }
    }
  }

  const createCameraConfig = () => {
    api.get(`/camera_config/empty/${videoId}`)
      .then((response) => {
        setCameraConfig(response.data);
      })
      .catch((error) => {
        console.error('Error occurred:', error);
      });

  }

  const createNewRecipe = (frameCount) => {
    api.post(`/recipe/empty/`)
      .then((response) => {
        const updatedRecipe = {
          ...response.data,
          end_frame: frameCount,
        }
        setRecipe(updatedRecipe);
      })
      .catch((error) => {
        console.error('Error occurred:', error);
      });

  }

  const deleteVideoConfig = async () => {
    let warnUser = "";
    if (video.video_config.sample_video_id === video.id && video.video_config.ready_to_run) {
      warnUser = "This video acts as the reference video for the current video configuration. Deleting means the actual configuration is removed irreversibly. Are you sure you want to remove the video configuration?"
    } else {
      warnUser = "This video uses another video's video configuration. Deleting means you can set a new video configuration for this particular video. This action is reversible by re-selecting the video configuration later. Do you want to remove the video configuration use?"
    }
    const userConfirmed = window.confirm(warnUser);
    if (userConfirmed) {
      if (video.video_config.sample_video_id === video.id && video.video_config.ready_to_run) {
        try {
          await api.delete(`/video_config/${videoConfig.id}/deps/`); // remove video config including its dependencies
          setMessageInfo("success", "Video configuration deleted successfully.");
        } catch (error) {
          console.error("Error deleting video configuration:", error);
          setMessageInfo("error", "Failed to delete video configuration. Please try again later.");
        }
      } else {
        try {
          await api.patch(`/video/${video.id}/`, {video_config_id: null });
        } catch (error) {
          console.error("Error patching video:", error);
          setMessageInfo("error", "Failed to patch video. Please try again later.");

        }

      }
      setVideoConfig(null); // Reset the video configuration in the state
      createNewRecipe();  // if the recipe exists, it will be overwritten later
      createCameraConfig();  // if the cam config exists, it will be overwritten later
      setCSDischarge({});
      setCSWaterLevel({});
      setActiveTab('configDetails');
      setActiveView('camView');
      setWidgets([]);
      setSelectedWidgetId(null);
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

  const runVideo = async () => {
    await run_video(video, setMessageInfo);
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
      // also remove selected cross-sections
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
          <div className="flex-container column" style={{height: "100%"}}>
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

            {video && activeView === 'camView' && recipe?.start_frame !== undefined && recipe?.start_frame !== null && (
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
                    Load/Save config
                  </button>
                  <button
                    className={activeTab === 'pose' ? 'active-tab' : ''}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabChange('pose');
                    }}
                    disabled={!cameraConfig?.isPoseReady()}
                  >
                    Camera pose
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
                      ws={ws.current}
                    />
                  </div>

                  {activeTab === 'gcps' && (
                    <CameraConfigForm
                      selectedCameraConfig={cameraConfig}
                      setSelectedCameraConfig={setCameraConfig}
                      setMessageInfo={setMessageInfo}
                      ws={ws.current}
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
                zMin={recipe?.min_z}
                zMax={recipe?.max_z}
                waterLevel={cameraConfig?.gcps?.z_0}
                yRightOffset={cameraConfig?.gcps?.h_ref - cameraConfig?.gcps?.z_0}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoConfig;
