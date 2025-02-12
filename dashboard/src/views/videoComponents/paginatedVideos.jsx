import { useState, useEffect } from "react";
import api from "../../api.js";
import {FaEye, FaPlay, FaTrash} from "react-icons/fa";

const PaginatedVideos = ({ initialData }) => {
  const [data, setData] = useState(initialData);  // initialize data with currently available
  const [currentPage, setCurrentPage] = useState(1); // Tracks current page
  const [rowsPerPage, setRowsPerPage] = useState(25); // Rows per page (default 25)
  const [selectedVideo, setSelectedVideo] = useState(null); // For modal view
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
    setCurrentPage(1); // Reset pagination when new data arrives
  }, [initialData]);


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

  // TODO: modal for "View" button action
  const handleView = (video) => {
    setSelectedVideo(video);
    setShowModal(true);
  };

  // Handler to go to the next page
  const handleNext = () => {
    if (currentPage < Math.ceil(data.length / rowsPerPage)) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  // Handler to go to the previous page
  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage((prevPage) => prevPage - 1);
    }
  };
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10)); // Update rows per page
    setCurrentPage(1); // Reset to the first page
  };
  // Close modal
  const closeModal = () => {
    setSelectedVideo(null);
    setShowModal(false);
  };

  return (
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
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
        {currentRecords.map((video, index) => (

          <tr key={idxFirst + index + 1}>
            <td>{video.id}</td>
            <td>{video.file}</td>
            <td>{video.timestamp}</td>
            <td><img src={`${api.defaults.baseURL}/video/${video.id}/thumbnail`}/></td>
            <td>h: {video.time_series ? video.time_series.h + " m" : "N/A"} Q: {video.time_series ? video.time_series.q_50 + " m3/s" : "N/A"}</td>
            <td>{video.status}</td>
            <td>
              <button
                className="btn btn-success btn-sm"
                onClick={() => handleRun(video.id)}
              >
                <FaPlay />
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleView(video)}
              >
                <FaEye />
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleDelete(video.id)}
              >
                <FaTrash />
              </button>
            </td>
          </tr>
        ))}
        </tbody>
      </table>

      {/* Pagination Controls */}
      <div className="d-flex justify-content-between align-items-center">
        {/* Rows Per Page Selector */}
        <div>
          <label htmlFor="rowsPerPage" className="me-2">Rows per page:</label>
          <select
            id="rowsPerPage"
            className="form-select d-inline-block w-auto"
            value={rowsPerPage}
            onChange={handleRowsPerPageChange}
          >
            {/* Options for Rows Per Page */}
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
          </select>
        </div>

        {/* Previous Button */}
        <button
          className="btn btn-secondary"
          onClick={handlePrevious}
          disabled={currentPage === 1} // Disable if on the first page
        >
          Previous
        </button>

        {/* Current Page Indicator */}
        <span>
          Page {currentPage} of {Math.ceil(data.length / rowsPerPage)}
        </span>

        {/* Next Button */}
        <button
          className="btn btn-secondary"
          onClick={handleNext}
          disabled={currentPage === Math.ceil(data.length / rowsPerPage)} // Disable if on the last page
        >
          Next
        </button>
      </div>
      {/* Modal */}
      {showModal && selectedVideo && (
        <div className="modal fade show d-block" tabIndex="-1">
          <div className="modal-dialog">
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
                <form>
                  <div className="mb-3">
                    <label htmlFor="modal-title" className="form-label">
                      Title:
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      id="modal-title"
                      value={selectedVideo.title}
                      onChange={(e) =>
                        setSelectedVideo({
                          ...selectedVideo,
                          title: e.target.value,
                        })
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label htmlFor="modal-description" className="form-label">
                      Description:
                    </label>
                    <textarea
                      className="form-control"
                      id="modal-description"
                      rows="3"
                      value={selectedVideo.description}
                      onChange={(e) =>
                        setSelectedVideo({
                          ...selectedVideo,
                          description: e.target.value,
                        })
                      }
                    ></textarea>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={closeModal}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    // Save the changes (optional Axios PUT/POST call)
                    console.log('Updated video:', selectedVideo);
                    closeModal();
                  }}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PaginatedVideos;