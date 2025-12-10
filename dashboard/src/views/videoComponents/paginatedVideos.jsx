import {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {DropdownMenu} from "../../utils/dropdownMenu.jsx"
import {run_video, sync_video} from "../../utils/apiCalls/video.jsx"
import {getLogLineStyle} from "../../utils/helpers.jsx";
import {VideoDetailsModal} from "./videoDetailsModal.jsx";
import {getStatusIcon, getSyncStatusIcon, getVideoConfigIcon, getVideoConfigTitle} from "./videoHelpers.jsx";

import PropTypes from "prop-types";

import Modal from "react-modal";
import api from "../../api/api.js";
import {
  FaPlay,
  FaTrash,
  FaExclamationTriangle, FaSync,
} from "react-icons/fa";
import { HiDocumentMagnifyingGlass } from "react-icons/hi2";

import {RiPencilFill} from "react-icons/ri";
import Paginate from "../../utils/paginate.jsx";
import ActionVideos from "./actionVideos.jsx";
import {useMessage} from "../../messageContext.jsx";
import VideoUploader from "./videoUpload.jsx";
import {createRoot} from "react-dom/client";
import {TimeSeriesChangeModal} from "./timeSeriesChangeModal.jsx";

const PaginatedVideos = ({startDate, endDate, setStartDate, setEndDate, videoRunState}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState([]);  // initialize data
  const [totalDataCount, setTotalDataCount] = useState(0); // total amount of records with filtering
  const [currentPage, setCurrentPage] = useState(1); // Tracks current page
  const [rowsPerPage, setRowsPerPage] = useState(10); // Rows per page (default 25)
  const [selectedVideo, setSelectedVideo] = useState(null); // For modal views, to select the right video
  const [uploadedVideo, setUploadedVideo] = useState(null);
  const [availableVideoConfigs, setAvailableVideoConfigs] = useState([]);
  const [videoLogData, setVideoLogData] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [showModal, setShowModal] = useState(false); // State for modal visibility
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showRunModal, setShowRunModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); // Array of selected video IDs

  // allow for setting messages
  const {setMessageInfo} = useMessage();
  const navigate = useNavigate();

  // Data must be updated when the page changes, when start and end date changes, or when
  useEffect(() => {
    // set loading
    setIsLoading(true);
    const params_page = {
      start: startDate,
      stop: endDate,
      first: (currentPage - 1) * rowsPerPage,
      count: rowsPerPage,
    }
    const params_total = {
      start: startDate,
      stop: endDate,
    }
    api.get('/video/', {params: params_page}) // Retrieve list from app
      .then((response) => {
        setData(response.data);
        // Calculate the index range for records to display
      })
      .catch((error) => {
        console.error('Error fetching video metadata:', error);
      })
      .finally(() => {
        setIsLoading(false)
      });
    // also get the total count of filtered videos without retrieving all of them
    api.get('/video/count/', {params: params_total}) // integer as response
      .then((response) => {

        setTotalDataCount(response.data);
      })
      .catch((error) => {
        console.error('Error fetching video count:', error);
      });

  }, [uploadedVideo, startDate, endDate, currentPage, rowsPerPage]);


  // Fetch the existing video configs when the modal is opened
  useEffect(() => {
    if (showConfigModal) {
      api.get("/video_config/") // Replace with your endpoint for fetching video configs
        .then((response) => {
          setAvailableVideoConfigs(response.data);
        })
        .catch((error) => {
          console.error("Error fetching video configs:", error);
        });
    }
  }, [showConfigModal]);

  useEffect(() => {
    if (!videoRunState) return;
    setData(prevData => {
      return prevData.map(video => {
        if (video.id === videoRunState.video_id) {
          // handle the video status
          let status;
          if (videoRunState.status === 3 || videoRunState.status === 4 || videoRunState.status === 5) {
            status = videoRunState.status
          } else {
            status = video.status;
          }
          // handle the sync status
          let sync_status;
          if (videoRunState.sync_status === 2 || videoRunState.sync_status === 3 || videoRunState.sync_status === 4) {
            sync_status = videoRunState.sync_status
          } else {
            sync_status = video.sync_status;
          }
          return {...video, status: status, sync_status: sync_status};
        }
        return video;
      });
    });
  }, [videoRunState])

  useEffect(() => {
    // ensure that time series information is always up-to-date
    if (!selectedVideo) return;
    setData(prevData => {
      return prevData.map(video => {
        if (video.id === selectedVideo.id) {
          return {...video, time_series: selectedVideo.time_series, video_config: selectedVideo.video_config};
        }
        return video;
      });
    });
  }, [selectedVideo]);

  const renderVideoConfigButton = (video) => {
    return (
      <button
        className="btn-icon"
        onClick={() => handleVideoConfig(video)}
        title={getVideoConfigTitle(video)}
      >
        {getVideoConfigIcon(video)}
      </button>
    )
  }

  const toggleSelect = (id) => {
    setSelectedIds((prevSelectedIds) =>
      prevSelectedIds.includes(id)
        ? prevSelectedIds.filter((selectedId) => selectedId !== id) // Deselect if already selected
        : [...prevSelectedIds, id] // Add if not already selected
    );
  };

  // Handle the "Delete" button action
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this video and all media files associated with it?')) {
      api.delete(`/video/${id}`)
        .then(() => {
          const updatedData = data.filter((video) => video.id !== id); // Remove from state
          setData(updatedData);

          // adjust current page if necessary as length of records may require
          if (updatedData.length <= (currentPage - 1) * rowsPerPage) {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
          }

        })
        .catch((error) => {
          console.error('Error deleting video with ID:', id, error);
        });
    }
  };
  // Handle the "Delete" button action
  const handleShowLog = (video) => {
    setSelectedVideo(video);
    api.get(`/video/${video.id}/log/`)
      .then((response) => {
        const lines = response.data.split("\n");
        setVideoLogData(lines);
        setShowLog(true);

      })
      .catch((error) => {
        setVideoLogData([`No log available for video with ID: ${video.id}`])
        console.error('Error fetching log for video with ID:', video.id, error);
        setShowLog(true);
      });
  }



  // TODO: modal for "View" button action
  const handleView = (video) => {
    setSelectedVideo(video);
    setShowModal(true);
  };

  const handleRun = (video) => {
    console.log(video);
    setSelectedVideo(video);
    setShowRunModal(true);
    // run_video(video, setMessageInfo);
  }

  const handleSync = (video) => {
    sync_video(video, setMessageInfo);
  }
  const handleVideoConfig = (video) => {
    setSelectedVideo(video); // Set the selected video
    setShowConfigModal(true); // Open the modal
  }

  // Function to handle configuration selection and API call
  const handleConfigSelection = (event) => {
    const {value} = event.target;
    try {
      // Send a POST request to update the video with the selected configuration
      api.patch(`/video/${selectedVideo.id}`, {
        video_config_id: value, // Pass the selected configuration ID
      });
      // Success feedback
      setMessageInfo('success', `Video configuration selected on ${value}`);
      setSelectedVideo(null)
      setShowConfigModal(false);
    } catch (error) {
      // Error handling
      setMessageInfo('error', 'Error while selecting video configuration', error.response.data);
    }
  };

  const createNewVideoConfig = (video_id) => {
    // redirect to editing or creating page for video config
    navigate(`/video_config/${video_id}`);
  }

  return (
    <div className="flex-container column no-padding">
      {isLoading && (
        <div className="spinner-viewport">
          <div className="spinner"/>
          <div>Loading videos...</div>
        </div>
      )}

      <div className="flex-container column">
        <div>
          <VideoUploader
            uploadedVideo={uploadedVideo}
            setUploadedVideo={setUploadedVideo}
          />
        </div>
        <ActionVideos
          data={data}
          selectedIds={selectedIds}
          startDate={startDate}
          endDate={endDate}
          idxFirst={currentPage * rowsPerPage}
          setData={setData}
          setSelectedIds={setSelectedIds}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          setCurrentPage={setCurrentPage}
          setMessageInfo={setMessageInfo}
        />
      </div>

      <div className="flex-container column">

        <h5>View / edit your videos</h5>
        <div role="alert" style={{color: "green", fontStyle: "italic"}}>
          Press Ctrl + R to refresh the status of your videos
        </div>


        <div>
          {/* Table */}
          <table className="table table-bordered table-striped">
            <thead>
            <tr>
              <th>
                <input
                  type="checkbox"
                  onChange={(e) =>
                    e.target.checked
                      ? setSelectedIds(data.map((record) => record.id)) // Select all visible records
                      : setSelectedIds([]) // Deselect all
                  }
                  checked={data.every((record) => selectedIds.includes(record.id)) && data.length > 0}
                />
              </th>
              <th>ID</th>
              <th>File</th>
              <th>Timestamp</th>
              <th>Thumbnail</th>
              <th>Video config</th>
              <th>Time series</th>
              <th>Status</th>
              <th>Sync status</th>
              <th style={{width: "189px", whiteSpace: "nowrap"}}>Actions</th>
            </tr>
            </thead>
            <tbody>
            {data.map((video, index) => (
              <tr key={currentPage * rowsPerPage + index + 1}>
                <td>
                  <input
                    type="checkbox" style={{height: "initial"}}
                    checked={selectedIds.includes(video.id)}
                    onChange={() => toggleSelect(video.id)}
                  />
                </td>
                <td>{video.id}</td>
                <td>{video.file ? video.file.split(`/${video.id}/`)[1] : "-"}</td>
                <td>{video.timestamp.slice(0, 19)}</td>
                <td>
                  <img
                    src={`${api.defaults.baseURL}/video/${video.id}/thumbnail/`}
                    onError={(e) => {
                      if (e.target.parentNode.querySelector(".fallback-container")) {
                        // Avoid creating multiple fallback containers
                        return;
                      }

                      e.target.onerror = null;  // stop looping error behaviour
                      e.target.style.display = "none";  // do not display default broken link icon
                      // add a div with a nice icon in case the thumbnail fails
                      const fallbackContainer = document.createElement("div"); // Add fallback icon dynamically
                      fallbackContainer.style.display = "inline-block"
                      fallbackContainer.classList.add("fallback-container");
                      // add container
                      e.target.parentNode.appendChild(fallbackContainer); // Append the fallback to td
                      const root = createRoot(fallbackContainer);
                      // render React icon into contains
                      root.render(
                        <FaExclamationTriangle size={16} color="red" title="Image not available"/>
                      )
                    }}
                  />
                </td>
                <td>{video.video_config ? video.video_config.id + ": " + video.video_config.name : "N/A"}</td>
                <td>
                  <strong><i>h</i></strong>: {video.time_series && video.time_series?.h ? Math.round(video.time_series.h * 1000) / 1000 + " m " : "N/A "}
                  | <strong><i>Q</i></strong>: {video.time_series && video.time_series?.q_50 ? Math.round(video.time_series.q_50 * 100) / 100 + " m3/s " : "N/A "}
                  | <strong><i>v<sub>surf</sub></i></strong>: {video.time_series && video.time_series?.v_av ? Math.round(video.time_series.v_av * 100) / 100 + " m/s " : "N/A "}
                  | <strong><i>v<sub>bulk</sub></i></strong>: {video.time_series && video.time_series?.v_bulk ? Math.round(video.time_series.v_bulk * 100) / 100 + " m/s " : "N/A "}
                </td>
                <td>{getStatusIcon(video.status)}</td>
                <td>{getSyncStatusIcon(video.sync_status)}</td>
                <td>
                  <button className="btn-icon"
                    // disabled when video config is not ready, or task is already queued (2) or running (3)
                          disabled={!video.allowed_to_run && video.status !== 2 && video.status !== 3}
                          onClick={() => handleRun(video)}
                  >
                    <FaPlay className="run"/>
                  </button>
                  <button className="btn-icon"
                    // disabled when video config is not ready, or task is already queued (2) or running (3)
                          disabled={!video.allowed_to_run && video.status !== 2 && video.status !== 3}
                          onClick={() => handleSync(video)}
                  >
                    <FaSync className="run"/>
                  </button>


                  <button className="btn-icon"
                          onClick={() => handleView(video)}
                  >
                    <RiPencilFill className="edit"/>
                  </button>
                  <button className="btn-icon"
                          onClick={() => handleDelete(video.id)}
                  >
                    <FaTrash className="danger"/>
                  </button>
                  <button
                    className="btn-icon"
                    onClick={() => handleShowLog(video)}
                    title={`Show the log of ${video.file}`}>
                    <HiDocumentMagnifyingGlass className="document"/>
                  </button>
                  {renderVideoConfigButton(video)}
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
        <div>
          <Paginate
            count={totalDataCount}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
            setCurrentPage={setCurrentPage}
            setRowsPerPage={setRowsPerPage}
          />
        </div>
      </div>
      {/*Modal for selecting a VideoConfig or creating a new Video Config*/}
      {/* Modal for video config */}
      <Modal
        isOpen={showConfigModal}
        onRequestClose={() => setShowConfigModal(false)}
        contentLabel="Video Configurations"

        style={{
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
          },

          content: {
            maxWidth: "500px",
            maxHeight: "400px",
            margin: "auto",
            padding: "20px",
          },
        }}
      >
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <h2>Video Configurations</h2>
          <button
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              lineHeight: "1",
            }}
            onClick={() => setShowConfigModal(false)}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        {selectedVideo && <p>Configuring Video: {selectedVideo.id}</p>}
        <h5>Select an Existing Config:</h5>
        <div className="container">
          <DropdownMenu
            dropdownLabel="Video configurations"
            callbackFunc={handleConfigSelection}
            data={availableVideoConfigs}
            value={selectedVideo ? selectedVideo.video_config_id : ""}
          />
        </div>
        <div className="container">
          <h5>Create new or edit existing config:</h5>
          <button className="btn" onClick={() => createNewVideoConfig(selectedVideo.id)}>Edit</button>
        </div>
      </Modal>

      {/* modal for video log file display */}
      <Modal
        isOpen={showLog}
        onRequestClose={() => setShowLog(false)}
        contentLabel="Video Log"
        style={{
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
          },
          content: {
            // maxWidth: "500px",
            margin: "auto",
            padding: "20px",
            height: "calc(100vh - 150px",
            minHeight: "500px",

          },
        }}
      >
        <div>
          {/*<div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>*/}
          <div className="modal-header">
            {selectedVideo && <h2 className="modal-title">Log for video: {selectedVideo.id}</h2>}
            <button
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                lineHeight: "1",
              }}
              onClick={() => setShowLog(false)}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <div className="flex-container column" style={{
            margin: "0px",
            marginTop: "20px",
            marginBottom: "20px",
            height: "calc(100vh - 320px)",
            minHeight: "500px"
          }}>
            <div
              className="log-container"
            >
              {videoLogData.length > 0 ? (
                videoLogData.map((line, index) => (
                  <div key={index} style={getLogLineStyle(line)}>
                    {line}
                  </div>
                ))
              ) : (
                <div>Loading logs...</div>
              )}
            </div>
          </div>

        </div>


      </Modal>
      {/*Modal for editing / analyzing video */}
      {showModal && selectedVideo && (
        <VideoDetailsModal
          selectedVideo={selectedVideo}
          setSelectedVideo={setSelectedVideo}
          setShowModal={setShowModal}
        />
      )}
      {/*Modal for running video */}
      {showRunModal && selectedVideo && (
        <TimeSeriesChangeModal setShowModal={setShowRunModal} video={selectedVideo} setVideo={setSelectedVideo}/>
      )}
    </div>
  );
};
PaginatedVideos.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  setStartDate: PropTypes.func.isRequired,
  setEndDate: PropTypes.func.isRequired,
  videoRunState: PropTypes.object,
};

export default PaginatedVideos;
