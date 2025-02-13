
const FilterDates = ({startDate, endDate, setStartDate, setEndDate, handleDateFilter}) => {
  return (
    <div className="ms-3" style={{minWidth: "250px", flex: 1}}>
      <h5>Filter Records</h5>
      <div className="mb-3">
        <label htmlFor="startDate" className="form-label">
          Start Date and Time
        </label>
        <input
          type="datetime-local"
          id="startDate"
          className="form-control"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>
      <div className="mb-3">
        <label htmlFor="endDate" className="form-label">
          End Date and Time
        </label>
        <input
          type="datetime-local"
          id="endDate"
          className="form-control"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>
      <button className="btn btn-primary" onClick={handleDateFilter}>
        Apply Filter
      </button>
    </div>
  )
};
export default FilterDates;