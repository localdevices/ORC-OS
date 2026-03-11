import "./filterDates.css"
import PropTypes from 'prop-types';

const FilterDates = ({startDate, endDate, setStartDate, setEndDate, title, handleDateFilter}) => {
  return (
    <div style={{"flex": "0 0 auto", "width": "300px"}}>
      <h5>{title ? (title) : ('Filter records')}</h5>
      <SelectDates
        startDate={startDate}
        endDate={endDate}
        setStartDate={setStartDate}
        setEndDate={setEndDate}
      />
      {handleDateFilter && (
      <button className="btn btn-primary" onClick={handleDateFilter}>
        Apply Filter
      </button>
  )}
    </div>
  )
};


const SelectDates = ({startDate, endDate, setStartDate, setEndDate}) => {
  return (
    <div className="date-picker-container" style={{"display": "flex", "flexDirection": "column"}}>
      <div className="mt-3">
        <input
          type="datetime-local"
          id="startDate"
          className="form-control"
          value={startDate || ""}
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
          value={endDate || ""}
          onChange={(e) => setEndDate(e.target.value)}
        />
        <div className="help-block">
          End date and time
        </div>
      </div>
    </div>
  )
}

FilterDates.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  setStartDate: PropTypes.func.isRequired,
  setEndDate: PropTypes.func.isRequired,
  title: PropTypes.string,
  handleDateFilter: PropTypes.func
};

SelectDates.propTypes = {
  startDate: PropTypes.string,
  endDate: PropTypes.string,
  setStartDate: PropTypes.func.isRequired,
  setEndDate: PropTypes.func.isRequired
};
export default FilterDates;

export {SelectDates};
