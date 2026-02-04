import { useEffect, useState, useRef } from "react";
import {useNavigate, useParams} from "react-router-dom";
import api, {createWebSocketConnection, closeWebSocketConnection, useDebouncedWsSender} from "../api/api.js";
import {run_video} from "../utils/apiCalls/video.jsx";
import {deepMerge} from "../utils/deepMerge.js";
import {toNumberOrNull} from "../utils/helpers.jsx";
import RecipeForm from "./recipeComponents/recipeForm.jsx";
import {FaSave, FaTrash, FaPlay, FaSpinner, FaHourglass} from "react-icons/fa";
import CameraConfigForm from "./VideoConfigComponents/cameraConfigForm.jsx";
import PoseDetails from "./VideoConfigComponents/poseDetails.jsx";
import VideoConfigForm from "./VideoConfigComponents/VideoConfigForm.jsx";
import CrossSectionForm from "./VideoConfigComponents/crossSectionForm.jsx";
import SideView from "./VideoConfigComponents/sideView.jsx";
import TopView from "./VideoConfigComponents/topView.jsx";
import VideoTab from "./calibrationTabs/videoTab.jsx";
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
  const [bboxSelected, setBboxSelected] = useState(false);  // state to check if bbox must be drawn

  const [activeTab, setActiveTab] = useState('configDetails');
  const [activeView, setActiveView] = useState('camView');
  const {setMessageInfo} = useMessage();

  // constants for image clicking
  const [widgets, setWidgets] = useState([]);
  const [selectedWidgetId, setSelectedWidgetId] = useState(null); // To track which widget is being updated
  const [imgDims, setImgDims] = useState(null);
  const [save, setSave] = useState(true);
  const [frameCount, setFrameCount] = useState(0);

  // allow for sending debounced msgs
  const sendDebouncedMsg = useDebouncedWsSender(ws.current, 400);
  // set navigation
  const navigate = useNavigate();

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
            callbackVideoStates,
            true,
            setMessageInfo,
          );
          ws.current = wsCur;
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

  const callbackVideoStates = (wsResponse, ws, setMessageInfo) => {
    // define what should happen with wsResponse once onmessage passes by
    // report save state
    // console.log("wsResponse:", wsResponse);
    if (!wsResponse.success && wsResponse.success !== undefined) {
      console.error("Error in wsResponse:", wsResponse);
      setMessageInfo("error", wsResponse.message);
      return
    }
    if (wsResponse.saved !== undefined) {
      setSave(!wsResponse.saved);
    }
    // figure out what was returned, video, video_config, recipe, camera_config, cross_section, cross_section_wl
    if (wsResponse.video) {
      // set and/or patch entire video
      setVideo(prevVideo =>
        deepMerge(prevVideo, wsResponse.video)
      );
    }
    if (wsResponse.video?.video_config) {
      hasRequestedResetRef.current = false;
      const patchVideoConfig = wsResponse.video.video_config;
      setVideoConfig(prevVideoConfig => {
        const merged = deepMerge(prevVideoConfig, wsResponse.video.video_config)
        return merged;
      });
      // check subcomponents nested
      if (patchVideoConfig.recipe) {

        setRecipe(prevRecipe => {
          const merged = deepMerge(prevRecipe, patchVideoConfig.recipe);
          return merged;
        });
      }
      if (patchVideoConfig.camera_config) {
        setCameraConfig(prevCameraConfig => {
          const merged = deepMerge(prevCameraConfig, wsResponse.video.video_config.camera_config)
          return merged;
        });
      }
      if ('cross_section' in patchVideoConfig) {
        setCSDischarge(prevCSDischarge => {
          const merged = deepMerge(prevCSDischarge, wsResponse.video.video_config.cross_section)
          return merged
        });
      }
      if ('cross_section_wl' in patchVideoConfig) {
        setCSWaterLevel(prevCSWaterLevel => {
          const merged = deepMerge(prevCSWaterLevel, wsResponse.video.video_config.cross_section_wl)

          return merged
        });
      }
    } else {
      // check if there is no video_config set, if so a new one must be created
      if (!hasRequestedResetRef.current && ws) {
        // a new recipe and camera config are needed, reset states to create new ones
        if (videoConfig === null || videoConfig === undefined) {
          hasRequestedResetRef.current = true;
          ws.sendJson({"action": "reset_video_config"})
        }
      }
    }
    if (wsResponse.success && wsResponse.message) {
      setMessageInfo("success", wsResponse.message);
      return
    }

  }

  const deleteVideoConfig = async () => {
    let warnUser = "";
    if (video.video_config.sample_video_id === video.id) { // && video.video_config.ready_to_run) {
      warnUser = "This video acts as the reference video for the current video configuration. Deleting means the actual configuration is removed irreversibly. Are you sure you want to remove the video configuration?"
    } else {
      warnUser = "This video uses another video's video configuration. Deleting means you can set a new video configuration for this particular video. This action is reversible by re-selecting the video configuration later. Do you want to remove the video configuration use?"
    }
    const userConfirmed = window.confirm(warnUser);
    if (userConfirmed) {
      if (video.video_config.sample_video_id === video.id) { //} && video.video_config.ready_to_run) {
        try {
          await api.delete(`/video_config/${videoConfig.id}/deps/`); // remove video config including its dependencies
          setMessageInfo("success", "Video configuration deleted successfully.");
          // re-navigate to page to refresh everything
          navigate(0)
        } catch (error) {
          console.error("Error deleting video configuration:", error);
          setMessageInfo("error", "Failed to delete video configuration. Please try again later.");
        }
      } else {
        try {
          await api.patch(`/video/${video.id}/`, {video_config_id: null });
          // re-navigate to page
          navigate(0)
        } catch (error) {
          console.error("Error patching video:", error);
          setMessageInfo("error", "Failed to patch video. Please try again later.");
        }
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

  const runVideo = async () => {
    await run_video(video, setMessageInfo);
  };

  const updateWidget = (id, coordinates) => {
    // first update widget fields for snappy UI response
    setWidgets((prevWidgets) => {
      const newWidgets = prevWidgets.map((widget) =>
        widget.id === id
          ? {
            ...widget,
            coordinates: {
              ...coordinates,
              x: toNumberOrNull(coordinates.x),
              y: toNumberOrNull(coordinates.y),
              z: toNumberOrNull(coordinates.z),
              row: toNumberOrNull(coordinates.row),
              col: toNumberOrNull(coordinates.col)

            }
          } : widget
      )
      return newWidgets;
    })
    // make sure coords are numeric
    const numericCoords = {
      x: toNumberOrNull(coordinates.x),
      y: toNumberOrNull(coordinates.y),
      z: toNumberOrNull(coordinates.z),
      row: toNumberOrNull(coordinates.row),
      col: toNumberOrNull(coordinates.col),
    };
    const updateCameraConfig = {
      gcps: {
        ...cameraConfig.gcps,
        control_points: cameraConfig.gcps.control_points.map((gcp, index) =>
          index + 1 === id ? {...gcp, ...numericCoords} : gcp
        )
      },
    }
    const videoPatch = {video_config: {
        camera_config: updateCameraConfig,
        cross_section: null,  // reset any pose dependent parameters
        cross_section_wl: null
      }};
    // send off to back end
    sendDebouncedMsg({
      action: 'update_video_config',
      op: 'set_field',
      params: {video_patch: videoPatch},
    });
    // update the camera config. This in turn should update the widget structure
  }


  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleViewChange = (view) => {
    setActiveView(view);
  };

  const handleBboxStart = () => {
    setBboxSelected(true);
    const msg = {
      action: 'update_video_config',
      op: 'reset_bbox',
      // params: {
      //   video_patch: {
      //     video_config: {
      //       camera_config: {bbox_camera: [], bbox: []},
      //       cross_section: {bbox_wet: []}
      //     }
      //   }
      // }
    }
    sendDebouncedMsg(msg);
    // setBBoxPolygon(null);
    // setWettedBbox(null);

    // // remove bbox_camera from cameraConfig
    // const newConfig = {
    //   ...cameraConfig,
    //   bbox_camera: null,
    // };
    //
    // setCameraConfig(newConfig);
  }


  return (
    <div style={{"position": "relative", "maxHeight": "100%", "display": "flex", "flexDirection": "column"}}>
      <h2>Video Configuration {video ? (video.id + ": " + video.timestamp) : (<p>Loading video...</p>)}</h2>
      <div className="split-screen flex">
        <div className="flex-container column no-padding">
          <div className="flex-container column" style={{height: "calc(100vh - 200px)", minHeight: "600px"}}>
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
                bboxSelected={bboxSelected}
                setCameraConfig={setCameraConfig}
                setSelectedWidgetId={setSelectedWidgetId}
                setImgDims={setImgDims}
                setBboxSelected={setBboxSelected}
                handleBboxStart={handleBboxStart}
                ws={ws.current}
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
        </div>
        <div className="flex-container column no-padding">
          <div className="flex-container column" style={{"height": "calc(100vh - 496px)"}}>
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
                      video={video}
                      cameraConfig={cameraConfig}
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
                        bboxSelected={bboxSelected}
                        setCameraConfig={setCameraConfig}
                        setCrossSection={setCrossSection}
                        setCSDischarge={setCSDischarge}
                        setCSWaterLevel={setCSWaterLevel}
                        setBboxSelected={setBboxSelected}
                        handleBboxStart={handleBboxStart}
                        setMessageInfo={setMessageInfo}
                        ws={ws.current}
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
                      setWidgets={setWidgets}
                      setSelectedWidgetId={setSelectedWidgetId}
                      setMessageInfo={setMessageInfo}
                      selectedVideo={video}
                      ws={ws.current}
                    />
                  )}
                  {activeTab === 'recipe' &&
                    (
                      <RecipeForm
                        selectedRecipe={recipe}
                        setSelectedRecipe={setRecipe}
                        frameCount={frameCount}
                        CSWaterLevel={CSWaterLevel}
                        CSDischarge={CSDischarge}
                        ws={ws.current}
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
