import React, {useState, useEffect} from "react";
import api from "../../api.js";
import {FaEye, FaPlay, FaTrash, FaSpinner, FaCheck, FaTimes, FaStar, FaHourglass
} from "react-icons/fa";
import {RiPencilFill} from "react-icons/ri";
import Paginate from "../../utils/paginate.jsx";
import FilterDates from "../../utils/filterDates.jsx";

const PaginatedVideos = ({initialData, startDate, endDate, setStartDate, setEndDate}) => {
  const [data, setData] = useState(initialData);  // initialize data with currently available
  const [currentPage, setCurrentPage] = useState(1); // Tracks current page
  const [rowsPerPage, setRowsPerPage] = useState(25); // Rows per page (default 25)
  const [imageError, setImageError] = useState(false);  // tracks errors in finding image in modal display
  const [videoError, setVideoError] = useState(false);  // tracks errors in finding video in modal display
  const [selectedVideo, setSelectedVideo] = useState(null); // For modal view, to select the right video
  const [showModal, setShowModal] = useState(false); // State for modal visibility

  // Calculate the index range for records to display
  const idxLast = currentPage * rowsPerPage;
  const idxFirst = idxLast - rowsPerPage;
  // Protect against empty data / Async updates
  const currentRecords = data.length
    ? data.slice(idxFirst, idxLast)
    : [];

  // const currentRecords = data.slice(idxFirst, idxLast);  // TODO: replace by a direct API call with limited amount

  // Optional: Watch for external updates to initialData and update `data` state
  useEffect(() => {
    setData(initialData);
    setCurrentPage(1);
  }, [initialData]);

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

  // Handle the "Run" button action
  const handleRun = (id) => {
    api.post(`/video/${id}/submit`)
      .then((response) => {
        // TODO: submit a change in video status (QUEUE)
        // TODO: create submit end point and logical processing queue
        console.log(`Video ${id} submitted to queue for ORC processing`);
      })
      .catch((error) => {
        console.error('Error triggering run action for video ID:', id, error);
      });
  };

  // Handle the "Delete" button action
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this video?')) {
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
  const handleDateFilter = () => {
    api.get('/video/', {params: {start: startDate, stop: endDate}}) // Retrieve list from api
      .then((response) => {
        setData(response.data);
        // Calculate the index range for records to display
      })
      .catch((error) => {
        console.error('Error fetching video metadata:', error);
      });
  }
  // TODO: modal for "View" button action
  const handleView = (video) => {
    setSelectedVideo(video);
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setSelectedVideo(null);
    setShowModal(false);
    setImageError(false);
    setVideoError(false);
  };

  return (
    <div style={{display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "20px"}}>
      <div>
        {/* Table */}
        <table className="table table-bordered table-striped">
          <thead>
          <tr>
            <th>ID</th>
            <th>File</th>
            <th>Timestamp</th>
            <th>Thumbnail</th>
            <th>Time series</th>
            <th>Status</th>
            <th style={{width: "150px", whiteSpace: "nowrap"}}>Actions</th>
          </tr>
          </thead>
          <tbody>
          {currentRecords.map((video, index) => (

            <tr key={idxFirst + index + 1}>
              <td>{video.id}</td>
              <td>{video.file.split(`/${video.id}/`)[1]}</td>
              <td>{video.timestamp.slice(0, 19)}</td>
              <td><img src={`${api.defaults.baseURL}/video/${video.id}/thumbnail`}/></td>
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
              </td>
            </tr>
          ))}
          </tbody>
        </table>
        <Paginate
          data={data}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          setCurrentPage={setCurrentPage}
          setRowsPerPage={setRowsPerPage}
        />
      </div>
      <FilterDates
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        handleDateFilter={handleDateFilter}
      />
      {/*Modal*/}
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
                <div style={{display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "20px"}}>
                  <div style={{width: "70%"}}>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row", gap: "10px"}}>
                      <label style={{minWidth: "100px"}}>Video</label>
                      <hr/>
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
                    </div>
                    <hr/>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row", gap: "10px"}}>
                      <label style={{minWidth: "100px"}}>Analysis results</label>
                      <hr/>
                      <div className="readonly">
                        {imageError ? (
                          <div>Image not found on system</div>
                        ) : (
                        <img
                          src={`${api.defaults.baseURL}/video/${selectedVideo.id}/image`}
                          width="100%"
                          onError={() => setImageError(true)}/>
                          )}
                      </div>
                    </div>
                  </div>
                  <div style={{minWidth: "30%"}}>
                    <div className="form-row">
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                      <label style={{minWidth: "100px"}}>
                        File:
                      </label>
                      <div className="readonly">{selectedVideo.file.split(`/${selectedVideo.id}/`)[1]}</div>
                    </div>
                      <hr/>
                    </div>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row", gap: "50px"}}>
                      <label>
                        Status:
                      </label>
                      <div className="readonly">{getStatusIcon(selectedVideo.status)}</div>
                    </div>
                    <hr/>
                    <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
                      <label style={{minWidth: "100px"}}>
                        Time Series:
                      </label>
                      <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
                        <div className="readonly">Water level: {selectedVideo.time_series ? selectedVideo.time_series.h : "-"}</div>
                        <div className="readonly">Discharge: {selectedVideo.time_series ? selectedVideo.time_series.q_50 : "-"}</div>
                      </div>
                    </div>
                    <hr/>
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