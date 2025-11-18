import api from "../../api/api.js";
import {useEffect, useState} from "react";
import {sync_videos} from "../../utils/apiCalls.jsx";

const SyncModal = ({showSyncModal, setShowSyncModal, urlSite, setMessageInfo}) => {
  const [syncStartDate, setSyncStartDate] = useState(null);
  const [syncEndDate, setSyncEndDate] = useState(null);
  const [syncSettings, setSyncSettings] = useState({
    "syncImage": true,
    "syncFile": true,
    // "downloadNetcdf": true,
    // "downloadLog": true,
  });
  const closeSyncModal = () => {
    setShowSyncModal(false); // Close the download modal
  };

  const handleCheckboxChange = (setting) => {
    setSyncSettings((prev) => ({
      ...prev,
      [setting]: !prev[setting],
    }));
  };

  const handleSyncConfirm = () => {
    // if (!downloadStartDate || !downloadEndDate) {
    //   alert("Please select both start and end dates.");
    //   return;
    // }
      sync_videos(api, syncStartDate, syncEndDate, syncSettings, setMessageInfo);
      setShowSyncModal(false); // Close modal on success
  };

  return (
    <>
      <div className="sidebar-overlay"></div>
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog" style={{maxWidth: "600px"}}>  {/*ensure modal spans a broad screen size*/}
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">Synchronize Videos</h5>
              <button
                type="button"
                className="btn-close"
                onClick={closeSyncModal}
              ></button>
            </div>
            <div className="modal-body">
              {/* Start and End Date Selection */}
              <div role="alert" style={{color: "green", fontStyle: "italic"}}>
                {`You will synchronize to site ${urlSite.remote_site_id} on ${urlSite.url}`}
              </div>
              <div className="form-group">
                <label>Start Date:</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={syncStartDate}
                  onChange={(e) => setSyncStartDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>End Date:</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={syncEndDate}
                  onChange={(e) => setSyncEndDate(e.target.value)}
                />
              </div>

              {/* Checkbox Options */}
              <div className="form-group">
                <label>What to synchronize:</label>
                <div>
                  <input
                    type="checkbox"
                    disabled={true}
                    id="syncTimeSeries"
                    checked={true}
                    onChange={() => handleCheckboxChange("syncTimeSeries")}
                  />
                  <label style={{paddingLeft: "10px"}} htmlFor="syncTimeSeries"> Time series</label>
                </div>
                <div>
                  <input
                    type="checkbox"
                    id="syncImage"
                    checked={syncSettings.syncImage}
                    onChange={() => handleCheckboxChange("syncImage")}
                  />
                  <label style={{paddingLeft: "10px"}} htmlFor="syncImage"> Image</label>
                </div>
                <div>
                  <input
                    type="checkbox"
                    id="syncFile"
                    checked={syncSettings.syncFile}
                    onChange={() => handleCheckboxChange("syncFile")}
                  />
                  <label style={{paddingLeft: "10px"}} htmlFor="syncFile"> Video</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={closeSyncModal}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSyncConfirm}
              >
                Confirm Synchronize
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
export default SyncModal;
