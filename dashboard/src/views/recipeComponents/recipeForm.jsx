import api from "../../api.js";
import {useEffect, useState} from "react";
import PropTypes from "prop-types";
import '../cameraAim.scss'

const RecipeForm = ({selectedRecipe, setSelectedRecipe, setMessageInfo}) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    start_frame: '',
    end_frame: '',
    freq: '',
    resolution: '',
    data: ''
  });
  const [showJsonData, setShowJsonData] = useState(false);

  useEffect(() => {
    if (selectedRecipe) {
      setFormData({
        name: selectedRecipe.name || '',
        id: selectedRecipe.id || '',
        start_frame: selectedRecipe.start_frame,
        end_frame: selectedRecipe.end_frame || '',
        freq: selectedRecipe.freq || '',
        resolution: selectedRecipe.resolution || '',
        data: JSON.stringify(selectedRecipe.data, null, 4) || '',
      });
    } else {
      setFormData({
        name: '',
        id: '',
        start_frame: '',
        end_frame: '',
        freq: '',
        resolution: '',
        data: '',
      })
    }

  }, [selectedRecipe]);

  // Utility function to safely parse JSON
  const safelyParseJSON = (jsonString) => {
    try {
      return JSON.parse(jsonString); // Parse if valid JSON string
    } catch (error) {
      console.warn("Invalid JSON string:", error);
      return jsonString; // Fallback: Leave it as the original string
    }
  };

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


  const submitData = (formData) => {
    return {
      id: formData.id || null,
      name: formData.name,
      data: safelyParseJSON(formData.data),
      start_frame: formData.start_frame,
      end_frame: formData.end_frame,
      freq: formData.freq,
      resolution: formData.resolution,
    }
  }

  const handleInputChange = async (event) => {
    const {name, value, type} = event.target;
    const updatedFormData = {
      ...formData,
      [name]: name === "resolution" ? parseFloat(value) : (type === "number" ? parseInt(value) : value)
    }
    setFormData(updatedFormData);

    try {
      const response = await api.post('/recipe/update/', submitData(updatedFormData));
      setSelectedRecipe(response.data);
    } catch (error) {
      console.error('Error updating YML:', error);
    }
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    // Dynamically filter only fields with non-empty values
    const filteredData = Object.fromEntries(
      Object.entries(formData).filter(([key, value]) => value !== '' && value !== null)
    );
    // predefine response object
    let response;
    try {
      console.log(submitData(filteredData));

      if (filteredData.id === undefined) {
        response = await api.post('/recipe/', submitData(filteredData));
      } else {
        response = await api.patch(`/recipe/${filteredData.id}`, submitData(filteredData));
      }
      console.log(response);
      if (response.status !== 201 && response.status !== 200) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
      }
      // reload page
      window.location.reload();
      setSelectedRecipe({})
      // set the form data to new device settings
      setFormData({
        name: '',
        id: '',
        start_frame: '',
        end_frame: '',
        freq: '',
        resolution: '',
        data: ''
      });
      setMessageInfo('success', 'Recipe stored successfully');
    } catch (err) {
      setMessageInfo('Error while storing recipe', err.response.data);
    }
  };


  return (
    <div style={{"padding": "5px"}}>
      <button
        className="btn"
        onClick={loadModal}
      >
        Upload from .yml
      </button>

      <form onSubmit={handleFormSubmit}>
        <div className='mb-3 mt-3'>
          <label htmlFor='id' className='form-label'>
            Recipe ID
          </label>
          <input type='str' className='form-control' id='id' name='id' value={formData.id} disabled />
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='name' className='form-label'>
            Name of recipe
          </label>
          <input type='str' className='form-control' id='name' name='name' onChange={handleInputChange} value={formData.name} required />
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='start_frame' className='form-label'>
            Start frame [nr]
          </label>
          <input type='number' className='form-control' id='start_frame' name='start_frame' step="1" onChange={handleInputChange} value={formData.start_frame} required />
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='end_frame' className='form-label'>
            End frame [nr]
          </label>
          <input type='number' className='form-control' id='end_frame' name='end_frame' step="1" onChange={handleInputChange} value={formData.end_frame} required />
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='freq' className='form-label'>
            Process every X frames [nr]
          </label>
          <input type='number' className='form-control' id='freq' name='freq' step="1" onChange={handleInputChange} value={formData.freq} required />
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='resolution' className='form-label'>
            Resolution [m]
          </label>
          <input type='number' className='form-control' id='resolution' name='resolution' step="0.001" min='0.001' max='0.05' onChange={handleInputChange} value={formData.resolution} required />
        </div>
        <button type='submit' className='btn'>
          Save
        </button>
        <div className='mb-3 mt-3'>Toggle JSON edits (advanced users only)
          <div className="form-check form-switch">
            <label className="form-label" htmlFor="toggleJson" style={{ marginLeft: '0' }}></label>
            <input
              style={{width: "40px", height: "20px", borderRadius: "15px"}}
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="toggleJson"
              onClick={() => setShowJsonData(!showJsonData)}
            />
          </div>
        </div>

        {showJsonData && (
          <div className="mb-3">
          <label htmlFor="data" className="form-label">JSON Data</label>
          <textarea
            id="data"
            className="form-control"
            rows="40"
            value={formData.data}
            onChange={handleInputChange}
          ></textarea>
        </div>
        )}
        <div>
        </div>

      </form>
    </div>

  )

};
RecipeForm.propTypes = {
    selectedRecipe: PropTypes.object,
    setSelectedRecipe: PropTypes.func.isRequired,
    setMessageInfo: PropTypes.func.isRequired,
};

export default RecipeForm;
