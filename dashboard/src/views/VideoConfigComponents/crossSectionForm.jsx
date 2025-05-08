import api from "../../api.js";
import {useEffect, useState, useRef} from "react";

const CrossSectionForm = (
  {
    selectedCSDischarge,
    selectedCSWaterLevel,
    setSelectedCSDischarge,
    setSelectedCSWaterLevel,
    setMessageInfo
  }
) => {
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    features: ''
  });
  const [showJsonData, setShowJsonData] = useState(false);
  const [coordinates, setCoordinates] = useState({x: [], y: [], z: []});

  useEffect(() => {
    if (selectedCrossSection) {
      setFormData({
        id: selectedCrossSection.id || '',
        name: selectedCrossSection.name || '',
        features: JSON.stringify(selectedCrossSection.features, null, 4) || '',
      });

      // Extract coordinates from features
      try {
        const features = typeof selectedCrossSection.features === 'string'
          ? JSON.parse(selectedCrossSection.features)
          : selectedCrossSection.features;

        if (features && features.coordinates) {
          const coords = features.coordinates.map(point => ({
            x: point[0],
            y: point[1],
            z: point[2]
          }));

          setCoordinates({
            x: coords.map(c => c.x),
            y: coords.map(c => y),
            z: coords.map(c => c.z)
          });
        }
      } catch (error) {
        console.error('Error parsing coordinates:', error);
      }
    } else {
      setFormData({
        name: '',
        id: '',
        features: '',
      });
      setCoordinates({x: [], y: [], z: []});
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
    // convert form data into JSON parsed object
    return {
      ...(formData.id && { id: formData.id }), // Include `id` only if it exists (truthy)
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

        <div className="mb-3 mt-3">
          <h6>Cross section top view</h6>
          <Line
            data={{
              labels: selectedCrossSection.x,
              datasets: [
                {
                  label: 'Cross Section Profile',
                  data: selectedCrossSection.y,
                  fill: false,
                  borderColor: 'rgb(75, 192, 192)',
                  tension: 0.1
                }
              ]
            }}
            options={{
              responsive: true,
              scales: {
                x: {
                  title: {
                    display: true,
                    text: 'X (m)'
                  }
                },
                y: {
                  title: {
                    display: true,
                    text: 'Y (m)'
                  }
                }
              }
            }}
          />
        </div>
        <div className="mb-3 mt-3">
          <h6>Cross section side view</h6>
          <Line
            data={{
              labels: selectedCrossSection.s,
              datasets: [
                {
                  label: 'Cross Section Profile',
                  data: selectedCrossSection.z,
                  fill: false,
                  borderColor: 'rgb(75, 192, 192)',
                  tension: 0.1
                }
              ]
            }}
            options={{
              responsive: true,
              scales: {
                x: {
                  title: {
                    display: true,
                    text: 'left-right (m)'
                  }
                },
                y: {
                  title: {
                    display: true,
                    text: 'Z (m)'
                  }
                }
              }
            }}
          />
        </div>

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

export default CrossSectionForm;
