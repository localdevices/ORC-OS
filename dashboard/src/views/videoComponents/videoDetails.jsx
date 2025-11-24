import {useState, useEffect} from "react";
import api from "../../api/api.js";
import {getStatusIcon, getSyncStatusIcon} from "./videoHelpers.jsx";
import PropTypes from 'prop-types'

export const VideoDetails = ({selectedVideo}) => {
  const [videoError, setVideoError] = useState(false);  // tracks errors in finding video in modal display
  const [imageError, setImageError] = useState(false);  // tracks errors in finding image in modal display

  // Close modal
  // const closeModal = () => {
  //   setSelectedVideo(null);
  //   setShowModal(false);
  //   setImageError(false);
  //   setVideoError(false);
  // };

  // get a callback url for LiveORC sync if present

  useEffect(() => {
    const fetchCallbackUrl = async () => {
      // TODO: make callback
      return null
    }
    fetchCallbackUrl();

  }, [])
  return (
  <>
    {/*<div className="sidebar-overlay"></div> /!*make background grey*!/*/}
    {/*<div className="modal fade show d-block" tabIndex="-1">*/}
    {/*  <div className="modal-dialog" style={{maxWidth: "900px"}}>  /!*ensure modal spans a broad screen size*!/*/}
    {/*    <div className="modal-content">*/}
    {/*      <div className="modal-header">*/}
    {/*        <h5 className="modal-title">Video Details</h5>*/}
    {/*        <button*/}
    {/*          type="button"*/}
    {/*          className="btn-close"*/}
    {/*          onClick={closeModal}*/}
    {/*        ></button>*/}
    {/*      </div>*/}
    {/*      <div className="modal-body">*/}
            <div className="flex-container no-padding" style={{overflow: "auto"}}>
              {/*<div className="card" style={{width: "70%"}}>*/}
                <div className="flex-container no-padding" style={{flexDirection: "column"}}>
                  <label style={{minWidth: "120px", fontWeight: "bold"}}>Video:</label>
                  <div className="readonly">
                    {videoError ? (
                      <div role="alert" style={{color: "red", fontStyle: "italic"}}>Video file not found or codec not available on your browser</div>
                    ) : (
                      <video
                        src={`${api.defaults.baseURL}/video/${selectedVideo.id}/play/`}
                        controls
                        width="90%"
                        onError={() => setVideoError(true)}
                      />
                    )}
                  </div>
                  <label style={{minWidth: "120px", fontWeight: "bold"}}>Analysis image:</label>
                  <div className="readonly">
                    {imageError ? (
                      <div>-</div>
                    ) : (
                      <img
                        src={`${api.defaults.baseURL}/video/${selectedVideo.id}/image/?datetime=${Date.now()}`}
                        width="90%"
                        onError={() => setImageError(true)}/>
                    )}
                  </div>
                </div>
              {/*</div>*/}
              {/*<div className="card" style={{minWidth: "30%"}}>*/}
                {/*<div className="form-row">*/}
              <div className={"flex-container row no-padding"} style={{flexDirection: "row", justifyContent: "start"}}>
                <div className="mb-3 mt-3">
                  <label style={{minWidth: "120px", fontWeight: "bold"}}>
                    File:
                  </label>
                  <div
                    className="readonly">{selectedVideo.file ? selectedVideo.file.split(`/${selectedVideo.id}/`)[1] : "-"}</div>
                </div>
                {/*</div>*/}
                <div className="mb-3 mt-3">
                  <label style={{minWidth: "120px", fontWeight: "bold"}}>
                    Time stamp:
                  </label>
                  <div className="readonly">{selectedVideo.timestamp}</div>
                </div>
                <div className="mb-3 mt-3">
                  <label style={{minWidth: "120px", fontWeight: "bold"}}>
                    Status:
                  </label>
                  <div className="readonly">{getStatusIcon(selectedVideo.status)}</div>
                </div>
                <div className="mb-3 mt-3">
                  <label style={{minWidth: "120px", fontWeight: "bold"}}>
                    Values:
                  </label>
                  <div style={{display: "flex", flexDirection: "column", gap: "10px"}}>
                    <div className="readonly">Water
                      level: {`${selectedVideo.time_series ? selectedVideo.time_series.h.toFixed(3) : "-"} m`}</div>
                    <div
                      className="readonly">Discharge: {`${selectedVideo.time_series ? selectedVideo.time_series.q_50.toFixed(3) : "-"} m3/s`}</div>
                  </div>
                </div>
                <div className="mb-3 mt-3">
                  <label style={{minWidth: "120px", fontWeight: "bold"}}>
                    LiveORC sync:
                  </label>
                  <div className="readonly">{getSyncStatusIcon(selectedVideo.sync_status)}</div>
                </div>
                <div className="mb-3 mt-3">
                  <label style={{minWidth: "120px", fontWeight: "bold"}}>
                    LiveORC id:
                  </label>
                  <div className="readonly">{selectedVideo.remote_id ? selectedVideo.remote_id : "N/A"}</div>
                </div>
                <div className="mb-3 mt-3">
                  <label style={{minWidth: "120px", fontWeight: "bold"}}>
                    LiveORC link:
                  </label>
                  {/*<div className="readonly">{selectedVideo.site_id ? selectedVideo.site_id : "N/A"}</div>*/}
                </div>
              </div>
            </div>
    {/*      </div>*/}
    {/*      <div className="modal-footer">*/}
    {/*        <button*/}
    {/*          type="button"*/}
    {/*          className="btn btn-secondary"*/}
    {/*          onClick={closeModal}*/}
    {/*        >*/}
    {/*          Close*/}
    {/*        </button>*/}

    {/*      </div>*/}
    {/*    </div>*/}
    {/*  </div>*/}
    {/*</div>*/}
  </>
  )
}

VideoDetails.propTypes = {
  selectedVideo: PropTypes.shape({
    id: PropTypes.number.isRequired,
    timestamp: PropTypes.string.isRequired,
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
};
