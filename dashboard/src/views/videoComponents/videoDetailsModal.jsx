

import {useState} from "react";
import {VideoDetails} from "./videoDetails.jsx";

export const VideoDetailsModal = ({selectedVideo, closeModal}) => {
  const [videoError, setVideoError] = useState(false);  // tracks errors in finding video in modal display
  const [imageError, setImageError] = useState(false);  // tracks errors in finding image in modal display

  // Close modal
  const closeActions = () => {
    closeModal();
    // setSelectedVideo(null);
    // setShowModal(false);
    setImageError(false);
    setVideoError(false);
  };

  return (
    <>
      <div className="sidebar-overlay"></div> {/*make background grey*/}
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "900px"}}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Video Details</h5>
              <button
                type="button"
                className="btn-close"
                onClick={closeActions}
              ></button>
            </div>
            <div className="modal-body">
            <VideoDetails selectedVideo={selectedVideo}/>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeActions}
              >
                Close
              </button>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
