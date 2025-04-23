import {useState, useEffect} from "react";
import api from "../../api.js";
import {FaSync, FaTrash, FaCheck} from "react-icons/fa";
import {RiPencilFill} from "react-icons/ri";
import Paginate from "../../utils/paginate.jsx";
import {useMessage} from "../../messageContext.jsx";
import RecipeForm from "./recipeForm.jsx";

const PaginatedRecipes = ({initialData}) => {
  const [data, setData] = useState(initialData);  // initialize data with currently available
  const [currentPage, setCurrentPage] = useState(1); // Tracks current page
  const [rowsPerPage, setRowsPerPage] = useState(25); // Rows per page (default 25)
  const [selectedRecipe, setSelectedRecipe] = useState(null); // For modal view, to select the right recipe
  const [showModal, setShowModal] = useState(false); // State for modal visibility
  // const [showDownloadModal, setShowDownloadModal] = useState(false); // State for modal visibility
  // const [showDeleteModal, setShowDeleteModal] = useState(false); // State for modal visibility
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

  // const currentRecords = data.slice(idxFirst, idxLast);  // TODO: replace by a direct API call with limited amount

  // Optional: Watch for external updates to initialData and update `data` state
  useEffect(() => {
    setData(initialData);
    setCurrentPage(1);
  }, [initialData]);

  useEffect(() => {
    if (selectedRecipe) {
      setShowModal(true);
    }

  }, [selectedRecipe]);

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
      alert("No recipes selected to delete.");
      return;
    }
    if (window.confirm(`Are you sure you want to delete ${selectedIds.length} recipes?`)) {
      Promise.all(
        selectedIds.map((id) => api.delete(`/recipe/${id}`).catch((error) => error)) // Attempt to delete each id and catch errors
      )
        .then(() => {
          // Remove deleted recipes from the state
          const updatedData = data.filter((recipe) => !selectedIds.includes(recipe.id));
          setData(updatedData);
          setSelectedIds([]);
          // Adjust current page if necessary
          if (updatedData.length <= idxFirst) {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
          }
        })
        .catch((error) => {
          console.error("Error deleting recipes:", error);
        });
    }
  };

  // Handle the "Delete" button action
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this recipe?')) {
      api.delete(`/recipe/${id}`) // Replace with your API endpoint
        .then(() => {
          const updatedData = data.filter((recipe) => recipe.id !== id); // Remove from state
          setData(updatedData);

          // adjust current page if necessary as length of records may require
          if (updatedData.length <= idxFirst) {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
          }

        })
        .catch((error) => {
          console.error('Error deleting recipe with ID:', id, error);
        });
    }
  };
  const handleView = (recipe) => {
    setSelectedRecipe(recipe);
    console.log(recipe);
  };

  // Close modal
  const closeModal = () => {
    setSelectedRecipe(null);
    setShowModal(false);
  };
  const createNewModal = () => {
    api.post(`/recipe/empty/`) // Replace with your API endpoint
      .then((response) => {
        setSelectedRecipe(response.data);
      })
      .catch((error) => {
        console.error('Error occurred:', error);
      });

  }
  const loadModal = async () => {
    console.log("load modal");
    const input = document.createElement('input');
    input.type = "file";
    input.accept = ".yml";
    // Wait for the user to select a file
    input.addEventListener('change', async (event) => {

    // input.onchange = async (event) => {
      const file = event.target.files[0]; // Get the selected file
      if (file) {
        const formData = new FormData(); // Prepare form data for file upload
        formData.append("file", file);

        try {
          const response = await api.post(
            '/recipe/from_file/',
            formData,
            {headers: {"Content-Type": "multipart/form-data",},}
          );
          // set the recipe to the returned recipe
          setSelectedRecipe(response.data);
        } catch (error) {
          console.error("Error occurred during file upload:", error);
        }
      }
    });
    // trigger input dialog box to open
    input.click();

  }

  const saveRecipe = async () => {
    const recipe_id = selectedRecipe.id;
    const response = await api.get(`/recipe/${recipe_id}/download/`, {}, {
      responseType: "blob"});
    const blob = new Blob([response.data], {type: "application/x-yaml;charset=utf-8"});
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.download = `recipe_${recipe_id}.yml`;
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
            {currentRecords.map((recipe, index) => (

              <tr key={idxFirst + index + 1}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(recipe.id)}
                    onChange={() => toggleSelect(recipe.id)}
                  />
                </td>
                <td>{recipe.id}</td>
                <td>{recipe.name}</td>
                <td>
                  <button className="btn-icon"
                          onClick={() => handleView(recipe)}
                  >
                    <RiPencilFill className="edit"/>
                  </button>
                  <button className="btn-icon"
                          onClick={() => handleDelete(recipe.id)}
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
            data={data}
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
            onClick={createNewModal}
          >
            Create new
          </button>
          <button
            className="btn"
            onClick={loadModal}
          >
            Upload from .yml
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
      {showModal && selectedRecipe && (
        <>
          <div className="sidebar-overlay"></div>
          <div className="modal fade show d-block" tabIndex="-1">
            <div className="modal-dialog" style={{maxWidth: "1200px"}}>  {/*ensure modal spans a broad screen size*/}
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title">Recipe details</h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={closeModal}
                  ></button>
                </div>
                <div className="modal-body">
                  <RecipeForm
                    selectedRecipe={selectedRecipe}
                    setSelectedRecipe={setSelectedRecipe}
                    setMessageInfo={setMessageInfo}
                  />
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={saveRecipe}
                    disabled={selectedRecipe.id === null ? "disabled" : "" }
                    >
                    Save to .yml
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeModal}
                  >
                    Close
                  </button>

                  {/*<button*/}
                  {/*  type="button"*/}
                  {/*  className="btn btn-primary"*/}
                  {/*  onClick={() => {*/}
                  {/*    // Save the changes (optional Axios PUT/POST call)*/}
                  {/*    console.log('Updated video:', selectedVideo);*/}
                  {/*    closeModal();*/}
                  {/*  }}*/}
                  {/*>*/}
                  {/*  Save Changes*/}
                  {/*</button>*/}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default PaginatedRecipes;
