import {useState, useEffect} from "react";
import { useNavigate } from "react-router-dom";
import { DropdownMenu } from "../../utils/dropdownMenu.jsx"
import Modal from "react-modal";

import api from "../../api.js";
import {FaSync, FaPlay, FaTrash, FaSpinner, FaCheck, FaTimes, FaStar, FaHourglass
} from "react-icons/fa";
// import camera icons for video config
import { TbCameraCancel, TbCameraCheck, TbCameraPin } from "react-icons/tb";
import {RiPencilFill} from "react-icons/ri";
import Paginate from "../../utils/paginate.jsx";
import ActionVideos from "./actionVideos.jsx";
import {useMessage} from "../../messageContext.jsx";
import VideoUploader from "./videoUpload.jsx";

const PaginatedVideos = ({initialData, startDate, endDate, setStartDate, setEndDate}) => {
  const [data, setData] = useState(initialData);  // initialize data with currently available
  const [currentPage, setCurrentPage] = useState(1); // Tracks current page
  const [rowsPerPage, setRowsPerPage] = useState(25); // Rows per page (default 25)
  const [imageError, setImageError] = useState(false);  // tracks errors in finding image in modal display
  const [videoError, setVideoError] = useState(false);  // tracks errors in finding video in modal display
  const [selectedVideo, setSelectedVideo] = useState(null); // For modal views, to select the right video
  const [availableVideoConfigs, setAvailableVideoConfigs] = useState([]);

  const [showModal, setShowModal] = useState(false); // State for modal visibility
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]); // Array of selected video IDs

  // Calculate the index range for records to display
  const idxLast = currentPage * rowsPerPage;
  const idxFirst = idxLast - rowsPerPage;
  // Protect against empty data / Async updates
  const currentRecords = data.length
    ? data.slice(idxFirst, idxLast)
    : [];
  // allow for setting messages
  const {setMessageInfo} = useMessage();
  const navigate = useNavigate();

  // const currentRecords = data.slice(idxFirst, idxLast);  // TODO: replace by a direct API call with limited amount

  // Optional: Watch for external updates to initialData and update `data` state
  useEffect(() => {
    setData(initialData);
    setCurrentPage(1);
  }, [initialData]);

  // update list of videos when changes in a video occur
  useEffect(() => {
    console.log("VIDEO SELECTED")
    api.get('/video/', { params: {start: startDate, stop: endDate}}) // Retrieve list from api
      .then((response) => {
        setData(response.data);
        // Calculate the index range for records to display
      })
      .catch((error) => {
        console.error('Error fetching video metadata:', error);
      });
  }, [selectedVideo, startDate, endDate]);


  // Fetch the existing video configs when the modal is opened
  useEffect(() => {
    if (showConfigModal) {
      api.get("/video_config/") // Replace with your endpoint for fetching video configs
        .then((response) => {
          setAvailableVideoConfigs(response.data);
          console.log(response.data)
        })
        .catch((error) => {
          console.error("Error fetching video configs:", error);
        });
    }
  }, [showConfigModal]);


  const getStatusIcon = (status) => {
    switch (status) {
      case 3:
        return <div><FaSpinner style={{ color: "blue" }} className="spinner" /> running</div>// Spinner for processing
      case 4:
        return <div><FaCheck style={{ color: "green" }} /> done</div>; // Success
      case 5:
        return <div><FaTimes style={{ color: "red" }} /> error</div>; // Error
      case 1:
        return <div><FaStar style={{ color: "gold" }} /> new</div>; // Warning
      case 2:
        return <div><FaHourglass style={{ color: "purple" }} /> queue</div>; // Pending
      default:
        return <FaSpinner style={{ color: "gray" }} className="spinner" />; // Default spinner
    }
  };
  const getSyncStatusIcon = (status) => {
    switch (status) {
      case null:
        return <div><FaSync style={{ color: "grey" }} /> not synced yet</div>// Spinner for processing
      case true:
        return <div><FaCheck style={{ color: "green" }} /> done</div>; // Success
      case false:
        return <div><FaSync style={{ color: "cadetblue" }} className="spinner" /> out of sync</div>; // Error
      default:
        return <FaSync style={{ color: "grey" }} />; // Default spinner
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prevSelectedIds) =>
      prevSelectedIds.includes(id)
        ? prevSelectedIds.filter((selectedId) => selectedId !== id) // Deselect if already selected
        : [...prevSelectedIds, id] // Add if not already selected
    );
  };
  //   // Handle the "Run" button action
  // const handleRun = (id) => {
  //   api.post(`/video/${id}/submit`)
  //     .then((response) => {
  //       // TODO: submit a change in video status (QUEUE)
  //       // TODO: create submit end point and logical processing queue
  //       console.log(`Video ${id} submitted to queue for ORC processing`);
  //     })
  //     .catch((error) => {
  //       console.error('Error triggering run action for video ID:', id, error);
  //     });
  // };

  // Handle the "Delete" button action
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this video and all media files associated with it?')) {
      api.delete(`/video/${id}`) // Replace with your API endpoint
        .then(() => {
          const updatedData = data.filter((video) => video.id !== id); // Remove from state
          setData(updatedData);

          // adjust current page if necessary as length of records may require
          if (updatedData.length <= idxFirst) {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
          }

        })
        .catch((error) => {
          console.error('Error deleting video with ID:', id, error);
        });
    }
  };
  // TODO: modal for "View" button action
  const handleView = (video) => {
    setSelectedVideo(video);
    setShowModal(true);
  };

  const handleVideoConfig = (video) => {
    setSelectedVideo(video); // Set the selected video
    setShowConfigModal(true); // Open the modal
  }

  // Function to handle configuration selection and API call
  const handleConfigSelection = async (selectedConfigId) => {
    try {
      // Send a POST request to update the video with the selected configuration
      const response = await api.patch(`/video/${selectedVideo.id}`, {
        video_config_id: selectedConfigId, // Pass the selected configuration ID
      });
      // Success feedback
      setMessageInfo('success', `Video configuration selected on ${selectedConfigId}`);
      setSelectedVideo(null)
      setShowConfigModal(false);
    } catch (error) {
      // Error handling
      setMessageInfo('error', 'Error while selecting video configuration', err.response.data);
    }
  };

  const createNewVideoConfig = (video_id) => {
    // redirect to editing or creating page for video config
    navigate(`/video_config/${video_id}`);
  }

  // Close modal
  const closeModal = () => {
    setSelectedVideo(null);
    setShowModal(false);
    setImageError(false);
    setVideoError(false);
  };

  return (
    <div style={{display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "20px", width: "100%"}}>
      <div style={{width: "80%", flex: 1, overflow: "auto", padding: "20px"}}>
        <div>
          <VideoUploader />
        </div>
        <h5>View / edit your videos</h5>

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
                    ? setSelectedIds(currentRecords.map((record) => record.id)) // Select all visible records
                    : setSelectedIds([]) // Deselect all
                }
                checked={currentRecords.every((record) => selectedIds.includes(record.id)) && currentRecords.length > 0}
              />
            </th>
            <th>ID</th>
            <th>File</th>
            <th>Timestamp</th>
            <th>Thumbnail</th>
            <th>Video config</th>
            <th>Time series</th>
            <th>Status</th>
            <th style={{width: "150px", whiteSpace: "nowrap"}}>Actions</th>
          </tr>
          </thead>
          <tbody>
          {currentRecords.map((video, index) => (

            <tr key={idxFirst + index + 1}>
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(video.id)}
                  onChange={() => toggleSelect(video.id)}
                />
              </td>
              <td>{video.id}</td>
              <td>{video.file ? video.file.split(`/${video.id}/`)[1] : "-"}</td>
              <td>{video.timestamp.slice(0, 19)}</td>
              <td><img src={`${api.defaults.baseURL}/video/${video.id}/thumbnail`}/></td>
              <td>{video.video_config ? video.video_config.id + ": " + video.video_config.name : "N/A"}</td>
              <td>h: {video.time_series ? Math.round(video.time_series.h * 1000) / 1000 + " m" : "N/A"} Q: {video.time_series ? Math.round(video.time_series.q_50 * 100) / 100 + " m3/s" : "N/A"}</td>
              <td>{getStatusIcon(video.status)}</td>
              <td>
                <button className="btn-icon"
                        onClick={() => handleView(video)}
                >
                  <FaPlay className="run"/>
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
                <button className="btn-icon"
                      onClick={() => handleVideoConfig(video)}
                      title={video.video_config ? (
                        video.video_config.sample_video_id === video.id ? (
                          "This video acts as a reference video for a video configuration. Click to change video configuration"
                        ): (
                          "This video has another video as a reference video. Click to change that video configuration"
                        )
                      ) : (
                        "No video configuration is set. Click to select an existing video configuration or create a new one based on this video, if it contains control point information."
                      )}

                >
                  {/*First check if has a config or not,
                  then check if video id is equal to the sample video id, if so this is a control video*/}
                  {video.video_config ? (
                    video.video_config.sample_video_id === video.id ? (
                      <TbCameraPin style={{"color": "blue"}} size={20} className="btn-icon"/>
                    ) : (
                      <TbCameraCheck style={{"color": "green"}} size={20} className="btn-icon"/>

                    )
                  ) : (
                    <TbCameraCancel style={{"color": "red"}} size={20} className="pulsating-icon"/>
                  )}
                </button>
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        </div>
        <div>
        <Paginate
          data={data}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          setCurrentPage={setCurrentPage}
          setRowsPerPage={setRowsPerPage}
        />
        </div>
      </div>
      <div style={{flexDirection: "column", flex: 0}}>
        <ActionVideos
          data={data}
          selectedIds={selectedIds}
          startDate={startDate}
          endDate={endDate}
          idxFirst={idxFirst}
          setData={setData}
          setSelectedIds={setSelectedIds}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          setCurrentPage={setCurrentPage}
          setMessageInfo={setMessageInfo}
          />
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
            margin: "auto",
            padding: "20px",
          },
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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
        <DropdownMenu
          dropdownLabel="Video configurations"
          callbackFunc={handleConfigSelection}
          data={availableVideoConfigs}
        />

        {/*<select*/}
        {/*  onChange={(event) => handleConfigSelection(event.target.value)}*/}
        {/*>*/}
        {/*  <option value="" disabled selected>*/}
        {/*    Select a configuration*/}
        {/*  </option>*/}
        {/*  {availableVideoConfigs.length > 0 ? (*/}
        {/*    availableVideoConfigs.map((config) => (*/}
        {/*      <option key={config.id} value={config.id}>*/}
        {/*        {config.name}*/}
        {/*      </option>*/}
        {/*    ))*/}
        {/*  ) : (*/}
        {/*    <option disabled>No existing configurations available.</option>*/}
        {/*  )}*/}
        {/*</select>*/}

        {/*<ul>*/}
        {/*  {availableVideoConfigs.length > 0 ? (*/}
        {/*    availableVideoConfigs.map((config) => (*/}
        {/*      <li key={config.id}>*/}
        {/*        {config.name}*/}
        {/*        <button*/}
        {/*          style={{ marginLeft: "10px" }}*/}
        {/*          onClick={() =>*/}
        {/*            alert(`Configured video: ${selectedVideo.id} with config: ${config.name}`)*/}
        {/*          }*/}
        {/*        >*/}
        {/*          Use*/}
        {/*        </button>*/}
        {/*      </li>*/}
        {/*    ))*/}
        {/*  ) : (*/}
        {/*    <p>No existing configurations available.</p>*/}
        {/*  )}*/}
        {/*</ul>*/}

        <h5>Create a New Config:</h5>
        <button className="btn" onClick={() => createNewVideoConfig(selectedVideo.id)}>Create config</button>

      </Modal>


      {/*Modal for editing / analyzing video */}
      {showModal && selectedVideo && (
        <>
        <div className="sidebar-overlay"></div>
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog" style={{maxWidth: "1200px"}}>  {/*ensure modal spans a broad screen size*/}
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Video Details</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={closeModal}
                ></button>
              </div>
              <div className="modal-body">
                <div className="flex-container">
                  <div className="card" style={{width: "70%"}}>
                    <div className="flex-container" style={{flexDirection: "column"}}>
                      <label style={{minWidth: "100px"}}>Video:</label>
                      <div className="readonly">
                        {videoError ? (
                          <div>Video file not found on system</div>
                        ) : (
                        <video
                          src={`${api.defaults.baseURL}/video/${selectedVideo.id}/play`}
                          controls
                          width="100%"
                          onError={() => setVideoError(true)}
                        />
                        )}
                      </div>
                      <label style={{minWidth: "100px"}}>Analysis:</label>
                      <div className="readonly">
                        {imageError ? (
                          <div>-</div>
                        ) : (
                        <img
                          src={`${api.defaults.baseURL}/video/${selectedVideo.id}/image`}
                          width="100%"
                          onError={() => setImageError(true)}/>
                          )}
                      </div>
                    </div>
                  </div>
                  <div className="card" style={{minWidth: "30%"}}>
                    {/*<div className="form-row">*/}
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                      <label style={{minWidth: "100px"}}>
                        File:
                      </label>
                      <div className="readonly">{selectedVideo.file ? selectedVideo.file.split(`/${selectedVideo.id}/`)[1] : "-"}</div>
                    </div>
                    {/*</div>*/}
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                      <label style={{minWidth: "120px"}}>
                        Status:
                      </label>
                      <div className="readonly">{getStatusIcon(selectedVideo.status)}</div>
                    </div>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                      <label style={{minWidth: "120px"}}>
                        Time Series:
                      </label>
                      <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
                        <div className="readonly">Water level: {selectedVideo.time_series ? selectedVideo.time_series.h : "-"}</div>
                        <div className="readonly">Discharge: {selectedVideo.time_series ? selectedVideo.time_series.q_50 : "-"}</div>
                      </div>
                    </div>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                      <label style={{minWidth: "120px"}}>
                        LiveORC sync:
                      </label>
                      <div className="readonly">{getSyncStatusIcon(selectedVideo.sync_status)}</div>
                    </div>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                      <label style={{minWidth: "120px"}}>
                        LiveORC video id:
                      </label>
                      <div className="readonly">{selectedVideo.remote_id ? selectedVideo.remote_id : "N/A" }</div>
                    </div>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                      <label style={{minWidth: "120px"}}>
                        LiveORC site id:
                      </label>
                      <div className="readonly">{selectedVideo.site_id ? selectedVideo.site_id : "N/A"}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Close
                </button>
                {/*<button*/}
                {/*  type="button"*/}
                {/*  className="btn btn-primary"*/}
                {/*  onClick={() => {*/}
                {/*    // Save the changes (optional Axios PUT/POST call)*/}
                {/*    console.log('Updated video:', selectedVideo);*/}
                {/*    closeModal();*/}
                {/*  }}*/}
                {/*>*/}
                {/*  Save Changes*/}
                {/*</button>*/}
              </div>
            </div>
          </div>
        </div>
        </>
      )}
    </div>
  );
};

export default PaginatedVideos;
