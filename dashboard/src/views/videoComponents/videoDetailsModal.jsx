import {useState} from "react";
import api from "../../api/api.js";
import {getStatusIcon, getSyncStatusIcon} from "./videoHelpers.jsx";
import PropTypes from 'prop-types'

export const VideoDetailsModal = ({selectedVideo, setSelectedVideo, setShowModal}) => {
  const [videoError, setVideoError] = useState(false);  // tracks errors in finding video in modal display
  const [imageError, setImageError] = useState(false);  // tracks errors in finding image in modal display

  // Close modal
  const closeModal = () => {
    setSelectedVideo(null);
    setShowModal(false);
    setImageError(false);
    setVideoError(false);
  };

  return (
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
                      <div>Video file not found or codec not available on your browser</div>
                    ) : (
                      <video
                        src={`${api.defaults.baseURL}/video/${selectedVideo.id}/play/`}
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
                        src={`${api.defaults.baseURL}/video/${selectedVideo.id}/image/`}
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
                  <div
                    className="readonly">{selectedVideo.file ? selectedVideo.file.split(`/${selectedVideo.id}/`)[1] : "-"}</div>
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
                    <div className="readonly">Water
                      level: {selectedVideo.time_series ? selectedVideo.time_series.h : "-"}</div>
                    <div
                      className="readonly">Discharge: {selectedVideo.time_series ? selectedVideo.time_series.q_50 : "-"}</div>
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
                  <div className="readonly">{selectedVideo.remote_id ? selectedVideo.remote_id : "N/A"}</div>
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

          </div>
        </div>
      </div>
    </div>
  </>
  )
}

VideoDetailsModal.propTypes = {
  selectedVideo: PropTypes.shape({
    id: PropTypes.number.isRequired,
    file: PropTypes.string,
    status: PropTypes.number.isRequired,
    sync_status: PropTypes.number.isRequired,
    remote_id: PropTypes.number,
    site_id: PropTypes.number,
    time_series: PropTypes.shape({
      h: PropTypes.number,
      q_50: PropTypes.number,
    }),
  }).isRequired,
  setSelectedVideo: PropTypes.func.isRequired,
  setShowModal: PropTypes.func.isRequired,
};
