import api from "../../api/api.js";
import {useState} from "react";
import {delete_videos} from "../../utils/apiCalls.jsx";

const DeleteModal = ({showDeleteModal, setShowDeleteModal, setMessageInfo}) => {
  const [deleteStartDate, setDeleteStartDate] = useState(null);
  const [deleteEndDate, setDeleteEndDate] = useState(null);
  const closeDeleteModal = () => {
    setShowDeleteModal(false); // Close the download modal
  };

  const handleDeleteConfirm = () => {
    if (!deleteStartDate || !deleteEndDate) {
      alert("Please select both start and end dates.");
      return;
    }
    alert("Your are going to delete videos between " + deleteStartDate + " and " + deleteEndDate);
    delete_videos(api, deleteStartDate, deleteEndDate, setMessageInfo);
    setShowDeleteModal(false); // Close modal on success
  };


  return (
    <>
      <div className="sidebar-overlay"></div>
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "600px"}}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Delete Videos</h5>
              You can here delete large sets of videos in one go by selecting a start and end date.
              <button
                type="button"
                className="btn-close"
                onClick={closeDeleteModal}
              ></button>
            </div>
            <div className="modal-body">
              {/* Start and End Date Selection */}
              <div className="form-group">
                <label>Start Date:</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={deleteStartDate}
                  onChange={(e) => setDeleteStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>End Date:</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={deleteEndDate}
                  onChange={(e) => setDeleteEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDeleteModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDeleteConfirm}
              >
                Confirm Download
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
export default DeleteModal;
