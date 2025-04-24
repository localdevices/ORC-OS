import api from "../../api.js";
import {useEffect, useState} from "react";
import PropTypes from "prop-types";
import '../cameraAim.scss'

const CrossSectionForm = ({selectedCrossSection, setSelectedCrossSection, setMessageInfo}) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    features: ''
  });
  const [showJsonData, setShowJsonData] = useState(false);

  useEffect(() => {
    if (selectedCrossSection) {
      setFormData({
        id: selectedCrossSection.id || '',
        name: selectedCrossSection.name || '',
        features: JSON.stringify(selectedCrossSection.features, null, 4) || '',
      });
    } else {
      setFormData({
        name: '',
        id: '',
        features: '',
      })
    }

  }, [selectedCrossSection]);


  // Utility function to safely parse JSON
  const safelyParseJSON = (jsonString) => {
    try {
      return JSON.parse(jsonString); // Parse if valid JSON string
    } catch (error) {
      console.warn("Invalid JSON string:", error);
      return jsonString; // Fallback: Leave it as the original string
    }
  };

  const submitData = (formData) => {
    return {
      id: formData.id || null,
      name: formData.name,
      features: safelyParseJSON(formData.features),
    }
  }

  const handleInputChange = async (event) => {
    const {name, value, type} = event.target;
    const updatedFormData = {
      ...formData,
      [name]: type === "number" ? parseInt(value) : value
    }
    setFormData(updatedFormData);

    try {
      const response = await api.post('/cross_section/update/', submitData(updatedFormData));
      setSelectedCrossSection(response.data);
    } catch (error) {
      console.error('Error updating GeoJSON:', error);
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
        response = await api.post('/cross_section/', submitData(filteredData));
      } else {
        response = await api.patch(`/cross_section/${filteredData.id}`, submitData(filteredData));
      }
      console.log(response);
      if (response.status !== 201 && response.status !== 200) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
      }
      // reload page
      window.location.reload();
      setSelectedCrossSection({})
      // set the form data to new device settings
      setFormData({
        name: '',
        id: '',
        features: ''
      });
      setMessageInfo('success', 'Cross section stored successfully');
    } catch (err) {
      setMessageInfo('Error while storing cross section', err.response.data);
    }
  };


  return (
    <div>
      <form onSubmit={handleFormSubmit}>
        <div className='mb-3 mt-3'>
          <label htmlFor='id' className='form-label'>
            Cross section ID
          </label>
          <input type='str' className='form-control' id='id' name='id' value={formData.id} disabled />
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='name' className='form-label'>
            Name of cross section
          </label>
          <input type='str' className='form-control' id='name' name='name' onChange={handleInputChange} value={formData.name} required />
        </div>
        <button type='submit' className='btn'>
          Submit
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
            <label htmlFor="features" className="form-label">JSON Data</label>
            <textarea
              id="features"
              className="form-control"
              rows="50"
              value={formData.features}
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
CrossSectionForm.propTypes = {
  selectedCrossSection: PropTypes.object,
  setSelectedCrossSection: PropTypes.func.isRequired,
  setMessageInfo: PropTypes.func.isRequired,
};

export default CrossSectionForm;
