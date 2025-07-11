import React from "react";
import "./filterDates.css"
const FilterDates = ({startDate, endDate, setStartDate, setEndDate, handleDateFilter}) => {
  return (
    <div>
      <h5>Filter Records</h5>
    <div className="date-picker-container">
      <div className="mb-3">
        <input
          type="datetime-local"
          id="startDate"
          className="form-control"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <div className="help-block">
          Start date and time
        </div>
      </div>
        <div className="mb-3">
          <input
            type="datetime-local"
            id="endDate"
            className="form-control"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
          <div className="help-block">
            End date and time
          </div>
        </div>

    </div>
      <button className="btn btn-primary" onClick={handleDateFilter}>
        Apply Filter
      </button>
    </div>
  )
};
export default FilterDates;
