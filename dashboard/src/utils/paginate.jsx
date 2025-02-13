const Paginate = ({data, currentPage, rowsPerPage, setCurrentPage, setRowsPerPage}) => {

  // Handler to go to the next page
  const handleNext = () => {
    if (currentPage < Math.ceil(data.length / rowsPerPage)) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  // Handler to go to the previous page
  const handlePrevious = () => {
    if (currentPage > 1) {
      setCurrentPage((prevPage) => prevPage - 1);
    }
  };
  const handleRowsPerPageChange = (e) => {
    setRowsPerPage(parseInt(e.target.value, 10)); // Update rows per page
    setCurrentPage(1); // Reset to the first page
  };

  return (
    <div className="d-flex justify-content-between align-items-center" style={{ flex: 0 }}>
      {/* Rows Per Page Selector */}
      <div>
        <label htmlFor="rowsPerPage" className="me-2">Rows per page:</label>
        <select
          id="rowsPerPage"
          className="form-select d-inline-block w-auto"
          value={rowsPerPage}
          onChange={handleRowsPerPageChange}
        >
          {/* Options for Rows Per Page */}
          <option value="10">10</option>
          <option value="25">25</option>
          <option value="50">50</option>
          <option value="100">100</option>
        </select>
      </div>

      {/* Previous Button */}
      <button
        className="btn btn-secondary"
        onClick={handlePrevious}
        disabled={currentPage === 1} // Disable if on the first page
      >
        Previous
      </button>

      {/* Current Page Indicator */}
      <span>
            Page {currentPage} of {Math.ceil(data.length / rowsPerPage)}
      </span>
      {/* Next Button */}
      <button
        className="btn btn-secondary"
        onClick={handleNext}
        disabled={currentPage === Math.ceil(data.length / rowsPerPage)} // Disable if on the last page
      >
        Next
      </button>
    </div>

  )
};
export default Paginate;