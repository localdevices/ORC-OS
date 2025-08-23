import {useState, useEffect} from "react";
import api from "../../api/api.js";
import {FaSync, FaTrash, FaCheck} from "react-icons/fa";
import {RiPencilFill} from "react-icons/ri";
import Paginate from "../../utils/paginate.jsx";
import {useMessage} from "../../messageContext.jsx";
import CrossSectionForm from "./crossSectionForm.jsx";

const PaginatedCrossSections = ({initialData}) => {
  const [data, setData] = useState(initialData);  // initialize data with currently available
  const [currentPage, setCurrentPage] = useState(1); // Tracks current page
  const [rowsPerPage, setRowsPerPage] = useState(25); // Rows per page (default 25)
  const [selectedCrossSection, setSelectedCrossSection] = useState(null); // For modal view, to select the right recipe
  const [showModal, setShowModal] = useState(false); // State for modal visibility
  const [selectedIds, setSelectedIds] = useState([]); // Array of selected video IDs

  // Calculate the index range for records to display
  const idxLast = currentPage * rowsPerPage;
  const idxFirst = idxLast - rowsPerPage;
  // Protect against empty data / Async updates
  const currentRecords = data.length
    ? data.slice(idxFirst, idxLast)
    : [];
  // allow for setting messages
  const {setMessageInfo} = useMessage();

  // Optional: Watch for external updates to initialData and update `data` state
  useEffect(() => {
    setData(initialData);
    setCurrentPage(1);
  }, [initialData]);

  useEffect(() => {
    if (selectedCrossSection) {
      setShowModal(true);
    }

  }, [selectedCrossSection]);

  const getSyncStatusIcon = (status) => {
    switch (status) {
      case null:
        return <div><FaSync style={{color: "grey"}}/> not synced yet</div>// Spinner for processing
      case true:
        return <div><FaCheck style={{color: "green"}}/> done</div>; // Success
      case false:
        return <div><FaSync style={{color: "cadetblue"}} className="spinner"/> out of sync</div>; // Error
      default:
        return <FaSync style={{color: "grey"}}/>; // Default spinner
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds((prevSelectedIds) =>
      prevSelectedIds.includes(id)
        ? prevSelectedIds.filter((selectedId) => selectedId !== id) // Deselect if already selected
        : [...prevSelectedIds, id] // Add if not already selected
    );
  };

  const handleDeleteSelected = () => {
    if (selectedIds.length === 0) {
      alert("No cross sections selected to delete.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} cross sections?`)) {
      Promise.all(
        selectedIds.map((id) => api.delete(`/cross_section/${id}`).catch((error) => error)) // Attempt to delete each id and catch errors
      )
        .then(() => {
          // Remove deleted recipes from the state
          const updatedData = data.filter((crossSection) => !selectedIds.includes(crossSection.id));
          setData(updatedData);
          setSelectedIds([]);
          // Adjust current page if necessary
          if (updatedData.length <= idxFirst) {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
          }
        })
        .catch((error) => {
          console.error("Error deleting cross sections:", error);
        });
    }
  };

  // Handle the "Delete" button action
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this cross section?')) {
      api.delete(`/cross_section/${id}`) // Replace with your API endpoint
        .then(() => {
          const updatedData = data.filter((crossSection) => crossSection.id !== id); // Remove from state
          setData(updatedData);

          // adjust current page if necessary as length of records may require
          if (updatedData.length <= idxFirst) {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
          }

        })
        .catch((error) => {
          console.error('Error deleting cross section with ID:', id, error);
        });
    }
  };
  const handleView = (crossSection) => {
    setSelectedCrossSection(crossSection);
    console.log(crossSection);
  };

  // Close modal
  const closeModal = () => {
    setSelectedCrossSection(null);
    setShowModal(false);
  };

  const loadModal = async (url, extension) => {
    const input = document.createElement('input');
    input.type = "file";
    input.accept = extension;
    // Wait for the user to select a file
    input.addEventListener('change', async (event) => {

      // input.onchange = async (event) => {
      const file = event.target.files[0]; // Get the selected file
      if (file) {
        const formData = new FormData(); // Prepare form data for file upload
        formData.append("file", file);

        try {
          const response = await api.post(
            url,
            formData,
            {headers: {"Content-Type": "multipart/form-data",},}
          );
          if (response.status === 201) {
            // set the cross section to the returned recipe
            setSelectedCrossSection(response.data);
          } else {
            console.error("Error occurred during file upload:", response.data);
            setMessageInfo('error', response.data.detail);

          }
        } catch (error) {
          console.error("Error occurred during file upload:", error);
          setMessageInfo('error', `Error: ${error.response.data.detail}`);
        }

      }
    });
    // trigger input dialog box to open
    input.click();
  }

  const loadGeoJsonModal = async () => {
    const url = '/cross_section/from_geojson/'
    const extension = '.geojson'
    loadModal(url, extension)
  }

  const loadCSVModal = async () => {
    const url = '/cross_section/from_csv/'
    const extension = '.csv'
    loadModal(url, extension)
  }

  const saveCrossSection = async () => {
    const cs_id = selectedCrossSection.id;
    const response = await api.get(`/cross_section/${cs_id}/download/`, {}, {
      responseType: "blob"});
    const blob = new Blob([response.data], {type: "application/json;charset=utf-8"});
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `cross_section_${cs_id}.geojson`;
    link.click();
  }

  return (
    <div style={{display: "flex", flexDirection: "row", alignItems: "flex-start", gap: "20px", width: "100%"}}>
      <div style={{width: "80%", flex: 1, overflow: "auto", padding: "20px"}}>
        <div>
          {/* Table */}
          <table className="table table-bordered table-striped">
            <thead>
            <tr>
              <th style={{ width: "40px" }}>
                <input
                  type="checkbox"
                  onChange={(e) =>
                    e.target.checked
                      ? setSelectedIds(currentRecords.map((record) => record.id)) // Select all visible records
                      : setSelectedIds([]) // Deselect all
                  }
                  checked={currentRecords.every((record) => selectedIds.includes(record.id)) && currentRecords.length > 0}
                />
              </th>
              <th>ID</th>
              <th>Name</th>
              <th style={{width: "90px", whiteSpace: "nowrap"}}>Actions</th>
            </tr>
            </thead>
            <tbody>
            {currentRecords.map((crossSection, index) => (

              <tr key={idxFirst + index + 1}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(crossSection.id)}
                    onChange={() => toggleSelect(crossSection.id)}
                  />
                </td>
                <td>{crossSection.id}</td>
                <td>{crossSection.name}</td>
                <td>
                  <button className="btn-icon"
                          onClick={() => handleView(crossSection)}
                  >
                    <RiPencilFill className="edit"/>
                  </button>
                  <button className="btn-icon"
                          onClick={() => handleDelete(crossSection.id)}
                  >
                    <FaTrash className="danger"/>
                  </button>
                </td>
              </tr>
            ))}
            </tbody>
          </table>
        </div>
        <div>
          <Paginate
            count={data.length}
            currentPage={currentPage}
            rowsPerPage={rowsPerPage}
            setCurrentPage={setCurrentPage}
            setRowsPerPage={setRowsPerPage}
          />
        </div>
      </div>
      <div style={{flexDirection: "column", flex: 0}}>
        <div className="ms-3" style={{minWidth: "250px", flex: 1}}>
          <button
            className="btn"
            onClick={loadGeoJsonModal}
          >
            Upload from .geojson
          </button>
          <button
            className="btn"
            onClick={loadCSVModal}
          >
            Upload from XYZ .csv
          </button>
          <button
            className="btn btn-danger"
            onClick={handleDeleteSelected}
            disabled={selectedIds.length === 0}
          >
            Delete selected
          </button>
        </div>

      </div>

      {/*Modal*/}
      {showModal && selectedCrossSection && (
        <>
          <div className="sidebar-overlay"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog" style={{maxWidth: "1200px"}}>  {/*ensure modal spans a broad screen size*/}
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Cross Section details</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeModal}
                  ></button>
                </div>
                <div className="modal-body">
                  <CrossSectionForm
                    selectedCrossSection={selectedCrossSection}
                    setSelectedCrossSection={setSelectedCrossSection}
                    setMessageInfo={setMessageInfo}
                  />
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={saveCrossSection}
                    disabled={selectedCrossSection.id === null ? "disabled" : "" }
                  >
                    Save to .geojson
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeModal}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PaginatedCrossSections;
