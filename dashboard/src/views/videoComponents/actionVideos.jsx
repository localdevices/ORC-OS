import FilterDates from "../../utils/filterDates.jsx";
import DownloadModal from "./downloadModal.jsx";
import DeleteModal from "./deleteModal.jsx";
import SyncModal from "./syncModal.jsx";
import api from "../../api/api.js";
import {get_videos_ids} from "../../utils/apiCalls/video.jsx";
import {useEffect, useState} from "react";

import PropTypes from 'prop-types';

const ActionVideos = (
  {
    data,
    selectedIds,
    startDate,
    endDate,
    idxFirst,
    setData,
    setSelectedIds,
    setStartDate,
    setEndDate,
    setCurrentPage,
    setMessageInfo
  }
) => {
  const [showDownloadModal, setShowDownloadModal] = useState(false); // State for modal visibility
  const [showSyncModal, setShowSyncModal] = useState(false); // State for modal visibility
  const [showDeleteModal, setShowDeleteModal] = useState(false); // State for modal visibility
  const [urlSite, setUrlSite] = useState(null);

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      alert("No videos selected to delete.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} videos?`)) {
      Promise.all(
        selectedIds.map((id) => api.delete(`/video/${id}`).catch((error) => error)) // Attempt to delete each id and catch errors
      )
        .then(() => {
          // Remove deleted videos from the state
          const updatedData = data.filter((video) => !selectedIds.includes(video.id));
          setData(updatedData);
          setSelectedIds([]);
          // Adjust current page if necessary
          if (updatedData.length <= idxFirst) {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
          }
        })
        .catch((error) => {
          console.error("Error deleting videos:", error);
        });
    }
  };


  const handleDownloadSelected = async () => {
    if (selectedIds.length === 0) {
      alert("No videos selected to download.");
      return;
    }
    get_videos_ids(api, selectedIds, setMessageInfo);
  };

  const urlSiteConfigured = async () => {
    const response = await api.get('/callback_url/')
    return response?.data
    //   .then((response) => {
    //     return response?.data?.remote_site_id
    //   })
    // .catch((error) => {
    //   console.error('Could not fetch callback url', error);
    // })

  }
  const handleDownloadBulk = async () => {
    setShowDownloadModal(true);
  }
  const handleSyncBulk = async () => {
    setShowSyncModal(true);
  }
  const handleDeleteBulk = async () => {
    setShowDeleteModal(true);
  }
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

  useEffect(() => {
    // set the url site
    const fetchUrl = async () => {
      try {
        const url = await urlSiteConfigured();
        setUrlSite(url);
      } catch (error) {
        console.error('Failed to load site, set to null', error)
        setUrlSite(null);
      }
    }
    fetchUrl()
  }, [])

  return (
    <div className="split-screen">
      <div className="ms-3">
        <h5>Selected</h5>
        {/*<hr/>*/}
        {/*<div style={{minWidth: "20%", flex: 0, padding: "20px"}}>*/}
        <button
          className="btn"
          onClick={handleDownloadSelected}
          disabled={selectedIds.length === 0}
        >
          Download
        </button>
        <button
          className="btn btn-danger"
          onClick={handleDeleteSelected}
          disabled={selectedIds.length === 0}
        >
          Delete
        </button>
      {/*</div>*/}
      {/*<div className="ms-3" style={{minWidth: "250px", flex: 1}}>*/}
        <h5>Bulk actions</h5>
        <button
          className="btn"
          onClick={handleDownloadBulk}
        >
          Download
        </button>
        <span
          title={
            urlSite?.remote_site_id
              ? "Synchronize videos with the configured LiveORC remote site id"
              : "No LiveORC remote site ID configured. Synchronization disabled."
          }
        >
          <button
            className="btn"
            onClick={handleSyncBulk}
            disabled={!urlSite?.remote_site_id}

          >
            Synchronize
          </button>
        </span>
        <button
          className="btn btn-danger"
          onClick={handleDeleteBulk}
        >
          Delete
        </button>
      </div>
      <FilterDates
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
        handleDateFilter={handleDateFilter}
      />
      {showDownloadModal && (
        <DownloadModal
          showDownloadModal={showDownloadModal}
          setShowDownloadModal={setShowDownloadModal}
          setMessageInfo={setMessageInfo}
        />
      )}
      {showSyncModal && (
        <SyncModal
          showSyncModal={showSyncModal}
          setShowSyncModal={setShowSyncModal}
          urlSite={urlSite}
          setMessageInfo={setMessageInfo}
        />
      )}
      {showDeleteModal && (
        <DeleteModal
          showDeleteModal={showDeleteModal}
          setShowDeleteModal={setShowDeleteModal}
          setMessageInfo={setMessageInfo}
        />
      )}


    </div>
  );
}

ActionVideos.propTypes = {
  data: PropTypes.array.isRequired,
  selectedIds: PropTypes.array.isRequired,
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  setData: PropTypes.func.isRequired,
  setSelectedIds: PropTypes.func.isRequired,
  setStartDate: PropTypes.func.isRequired,
  setEndDate: PropTypes.func.isRequired,
  setCurrentPage: PropTypes.func.isRequired,
  setMessageInfo: PropTypes.func.isRequired,
  idxFirst: PropTypes.number.isRequired,
};

export default ActionVideos;
