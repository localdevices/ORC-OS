const Paginate = ({count, currentPage, rowsPerPage, setCurrentPage, setRowsPerPage}) => {

  // Handler to go to the next page
  const handleNext = () => {
    if (currentPage < Math.ceil(count / rowsPerPage)) {
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
    <div className="d-flex justify-content-between align-items-center gap-2" style={{flex: 0}}>
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

      {/* Page Selector Dropdown */}
      <div>
        <select
          className="form-select d-inline-block w-auto mx-2"
          value={currentPage}
          onChange={(e) => setCurrentPage(parseInt(e.target.value, 10))}
        >
          {[...Array(Math.ceil(count / rowsPerPage))].map((_, index) => (
            <option key={index + 1} value={index + 1}>
              Page {index + 1} of {Math.ceil(count / rowsPerPage)}
            </option>
          ))}
        </select>
      </div>

      {/* Next Button */}
      <button
        className="btn btn-secondary"
        onClick={handleNext}
        disabled={currentPage === Math.ceil(count / rowsPerPage)} // Disable if on the last page
      >
        Next
      </button>
    </div>

  )
};
export default Paginate;
