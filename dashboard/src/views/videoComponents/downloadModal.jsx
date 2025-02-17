import api from "../../api.js";
import {useState} from "react";
import {get_videos} from "../../utils/apiCalls.jsx";

const DownloadModal = ({showDownloadModal, setShowDownloadModal, setMessageInfo}) => {
  const [downloadStartDate, setDownloadStartDate] = useState(null);
  const [downloadEndDate, setDownloadEndDate] = useState(null);
  const [downloadSettings, setDownloadSettings] = useState({
    downloadImage: true,
    downloadVideo: true,
    downloadNetcdf: true,
    downloadLog: true,
  });
  const closeDownloadModal = () => {
    setShowDownloadModal(false); // Close the download modal
  };

  const handleCheckboxChange = (setting) => {
    setDownloadSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
    console.log(downloadSettings);
  };

  const handleDownloadConfirm = () => {
    // if (!downloadStartDate || !downloadEndDate) {
    //   alert("Please select both start and end dates.");
    //   return;
    // }
    get_videos(api, downloadStartDate, downloadEndDate, downloadSettings, setMessageInfo);
    // Example API call for handling download
    // api.post("/video/download", {
    //   start: downloadStartDate,
    //   stop: downloadEndDate,
    //   get_image: downloadSettings.downloadImage,
    //   get_video: downloadSettings.downloadVideo,
    //   get_netcdf: downloadSettings.downloadNetcdf,
    //   get_log: downloadSettings.downloadLog,
    // })
    //   .then(() => {
    //     alert("Download started successfully!");
    setShowDownloadModal(false); // Close modal on success
      // })
      // .catch((error) => {
      //   console.error("Error during download:", error);
      //   alert("Failed to start download.");
      // });
  };


  return (
    <>
      <div className="sidebar-overlay"></div>
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "600px"}}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Download Videos</h5>
              <button
                type="button"
                className="btn-close"
                onClick={closeDownloadModal}
              ></button>
            </div>
            <div className="modal-body">
              {/* Start and End Date Selection */}
              <div className="form-group">
                <label>Start Date:</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={downloadStartDate}
                  onChange={(e) => setDownloadStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>End Date:</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={downloadEndDate}
                  onChange={(e) => setDownloadEndDate(e.target.value)}
                />
              </div>

              {/* Checkbox Options */}
              <div className="form-group">
                <label>What to download:</label>
                <div>
                  <input
                    type="checkbox"
                    id="downloadImage"
                    checked={downloadSettings.downloadImage}
                    onChange={() => handleCheckboxChange("downloadImage")}
                  />
                  <label style={{paddingLeft: "10px"}} htmlFor="downloadImage"> Image</label>
                </div>
                <div>
                  <input
                    type="checkbox"
                    id="downloadVideo"
                    checked={downloadSettings.downloadVideo}
                    onChange={() => handleCheckboxChange("downloadVideo")}
                  />
                  <label style={{paddingLeft: "10px"}} htmlFor="downloadVideo"> Video</label>
                </div>
                <div>
                  <input
                    type="checkbox"
                    id="downloadNetcdf"
                    checked={downloadSettings.downloadNetcdf}
                    onChange={() => handleCheckboxChange("downloadNetcdf")}
                  />
                  <label style={{paddingLeft: "10px"}} htmlFor="downloadNetcdf"> NetCDF Files</label>
                </div>
                <div>
                  <input
                    type="checkbox"
                    id="downloadLog"
                    checked={downloadSettings.downloadLog}
                    onChange={() => handleCheckboxChange("downloadLog")}
                  />
                  <label style={{paddingLeft: "10px"}} htmlFor="downloadLog"> Log Files</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeDownloadModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleDownloadConfirm}
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
export default DownloadModal;
