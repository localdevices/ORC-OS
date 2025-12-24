import FilterDates from "../../utils/filterDates.jsx";
import DownloadModal from "./downloadModal.jsx";
import api from "../../api/api.js";
import {useState} from "react";

import PropTypes from 'prop-types';

const ActionTimeSeries = (
  {
    startDate,
    endDate,
    setData,
    setStartDate,
    setEndDate,
    setMessageInfo
  }
) => {
  const [showDownloadModal, setShowDownloadModal] = useState(false); // State for modal visibility

  const handleDownloadBulk = async () => {
    setShowDownloadModal(true);
  }
  const handleDateFilter = () => {
    // TODO: replace for api utils call
    api.get('/time_series/', {params: {start: startDate, stop: endDate}}) // Retrieve list from api
      .then((response) => {
        setData(response.data);
        // Calculate the index range for records to display
      })
      .catch((error) => {
        console.error('Error fetching time series:', error);
      });
  }

  return (
    <div className="split-screen">
      <div className="ms-3">
        <h5>Bulk actions</h5>
        <button
          className="btn"
          onClick={handleDownloadBulk}
        >
          Download
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
    </div>
  );
}

ActionTimeSeries.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  setData: PropTypes.func.isRequired,
  setStartDate: PropTypes.func.isRequired,
  setEndDate: PropTypes.func.isRequired,
  setMessageInfo: PropTypes.func.isRequired,
};

export default ActionTimeSeries;
