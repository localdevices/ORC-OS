import api from "../../api/api.js";
import {useState} from "react";
import {getTimeSeries} from "../../utils/apiCalls/timeSeries.jsx";

const DownloadModal = ({showDownloadModal, setShowDownloadModal, setMessageInfo}) => {
  const [downloadStartDate, setDownloadStartDate] = useState(null);
  const [downloadEndDate, setDownloadEndDate] = useState(null);
  const [downloadSettings, setDownloadSettings] = useState({
    "format": "csv",
    "descending": true,
  });
  const closeDownloadModal = () => {
    setShowDownloadModal(false); // Close the download modal
  };

  const handleCheckboxChange = (setting) => {
    setDownloadSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const handleDownloadConfirm = () => {
    // TODO implement download
    // downloadTimeSeries(api, downloadStartDate, downloadEndDate, downloadSettings, setMessageInfo);
    setShowDownloadModal(false); // Close modal on success
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
                    id="descending"
                    checked={downloadSettings.descending}
                    onChange={() => handleCheckboxChange("descending")}
                  />
                  <label style={{paddingLeft: "10px"}} htmlFor="descending"> Descending</label>
                </div>

                <div>
                  <input
                    type="checkbox"
                    id="format"
                    checked={downloadSettings.format}
                    onChange={() => handleCheckboxChange("format")}
                  />
                  <label style={{paddingLeft: "10px"}} htmlFor="format"> CSV</label>
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
