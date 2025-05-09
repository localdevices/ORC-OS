import api from "../../api.js";
import {useEffect, useState, useRef} from "react";
import {DropdownMenu} from "../../utils/dropdownMenu.jsx";

const CrossSectionForm = (
  {
    crossSection,
    CSDischarge,
    CSWaterLevel,
    setCrossSection,
    setCSDischarge,
    setCSWaterLevel,
    setMessageInfo
  }
) => {
  // form data as the user sees it on the screen
  const [formData, setFormData] = useState({
    name: '',
    file: null
  });
  // form data as posted to store in back end
  const [formSubmitData, setFormSubmitData] = useState({
    name: '',
    features: {}
  })

  const [showJsonData, setShowJsonData] = useState(false);
  const [availableCrossSections, setAvailableCrossSections] = useState([]);

  useEffect(() => {
    const fetchCrossSections = async () => {
      try {
        const response = await api.get('/cross_section');
        setAvailableCrossSections(response.data);
      } catch (error) {
        setMessageInfo({
          type: 'error',
          message: 'Failed to fetch cross sections: ' + error.message
        });
      }
    };
    fetchCrossSections();
  }, []);

  const handleDischargeCS = async (event) => {
    console.log(event.target.value);
    const {name, value, type} = event.target;
    try {
      const response = await api.get(`cross_section/${value}`);
      setCSDischarge(response.data);
      setMessageInfo('success', `Successfully set discharge cross section to cross section ID ${value}`)

    } catch (error) {
      setMessageInfo('error', `Failed to fetch cross section discharge: ${error.message}`)
    }
    console.log(CSDischarge);
  }

  const handleInputChange = (event) => {
    console.log(event.target.files);
    const value = event.target.type === 'file' ? event.target.files[0] : event.target.value;

    setFormData({
      ...formData,
      [event.target.name]: value
    });
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      await loadFile();
      // Additional steps after successful file load
      console.log("processing cross section data...")
      if (formData.name) {
        setFormSubmitData({
          name: formData.name,
          features: crossSection.features,
        });
        console.log(formSubmitData);
        await api.post('/cross_section/', formSubmitData);
        setMessageInfo('success', 'Successfully created cross section');
      }
    } catch (error) {
      console.log("File loading not successful, do nothing...");
    }
  }

  const loadFile = async () => {
    try {

      if (!formData.file) {
        setMessageInfo('error', 'Please select a file');
        return;
      }

      const fileFormData = new FormData();
      fileFormData.append("file", formData.file);

      try {
        const response = await api.post(
          '/cross_section/from_csv/',
          fileFormData,
          {headers: {"Content-Type": "multipart/form-data"}}
        );
        setCrossSection(response.data);
        setMessageInfo('success', 'Successfully uploaded CSV file');
        return;
      } catch (csvError) {
        try {
          const geoJsonResponse = await api.post(
            '/cross_section/from_geojson/',
            fileFormData,
            {headers: {"Content-Type": "multipart/form-data"}}
          );
          setCrossSection(geoJsonResponse.data);
          setMessageInfo('success', 'Successfully uploaded GeoJSON file');
          return;
        } catch (geoJsonError) {
          throw new Error(`Failed to parse file as CSV (${csvError.response.data.detail}) or as GeoJSON (${geoJsonError.response.data.detail})`);
        }
      }
    } catch (error) {
      console.error("Error occurred during file upload:", error);
      setMessageInfo('error', `Error: ${error.response?.data?.detail || error.message}`);
      throw new Error(error);  // exit function with error so that we can catch that outside of this function
    }
  }

  return (
    <div className="split-screen">
      <div className='container' style={{marginTop: '5px'}}>
        <h5>Create new cross sections</h5>
        <form onSubmit={handleSubmit}>
        <div className='mb-3 mt-3'>
            <label htmlFor='name' className='form-label'>
              Name of cross section
            </label>
            <input type='str' className='form-control' id='name' name='name' onChange={handleInputChange} value={formData.name} required/>

          </div>
          <div className='mb-3 mt-3'>
            <label htmlFor='file' className='form-label'>
              Choose file (.csv with X, Y, Z, or GeoJSON)
            </label>
            <input type='file' className='form-control' id='file' name='file'
                   accept=".geojson,.csv" onChange={handleInputChange} required/>
          </div>

          <button type='submit' className='btn'>
            Submit
          </button>

          <div className="mb-3 mt-3">

            <div className='mb-3 mt-3'>Toggle JSON edits (advanced users only)
              <div className="form-check form-switch">
                <label className="form-label" htmlFor="toggleJson" style={{marginLeft: '0'}}></label>
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
                  // value={formData.features}
                  // onChange={handleInputChange}
                ></textarea>
              </div>
            )}
          </div>
        </form>
      </div>
      <div className='container' style={{marginTop: '5px'}}>
        <h5>Select discharge cross section</h5>
        <DropdownMenu dropdownLabel="Discharge cross section" callbackFunc={handleDischargeCS} data={availableCrossSections}/>
      </div>
    </div>

  )

};

export default CrossSectionForm;
