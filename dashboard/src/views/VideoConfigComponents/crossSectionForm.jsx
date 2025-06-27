import api from "../../api.js";
import React, {useEffect, useState, useRef} from "react";
import {DropdownMenu} from "../../utils/dropdownMenu.jsx";

const CrossSectionForm = (
  {
    cameraConfig,
    crossSection,
    CSDischarge,
    CSWaterLevel,
    setCameraConfig,
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

  useEffect(() => {
    fetchCrossSections();
  }, []);

  const handleCS = async (event, setter) => {
    const {value, name} = event.target;
    const nameCapitalize = name.charAt(0).toUpperCase() + name.slice(1);
    if (value) {
      try {
        const response = await api.post(
          `cross_section/${value}/camera_config/?${new Date().getTime()}`,
          cameraConfig
        );
        if (!response.data.within_image) {
          setMessageInfo('error', `${nameCapitalize} cross section is not within the image`)
        } else if (response.data.distance_camera > 1000) {
          setMessageInfo('error', `${nameCapitalize} cross section is too far away from the camera (> 1000 m.)`)
        } else {
          setter(response.data);
          console.log(response.data);
          setMessageInfo('success', `Successfully set ${name} cross section to ID ${value}`)
        }
      } catch (error) {
        console.log(error);
        setMessageInfo('error', `Failed to fetch ${name} cross section: ${error.response.data.detail || error.message}`)
      }
    } else {
      setter({});
      setMessageInfo('success', `Successfully removed ${name} cross section`)
    }
  }

  const handleWaterLevelChange = async (event) => {
    const {name, value} = event.target;
    const newConfig = {
      ...cameraConfig,
      gcps: {
        ...cameraConfig.gcps,
        [name]: parseFloat(value)

      }
    }
    setCameraConfig(newConfig);
  }

  const handleInputChange = (event) => {
    const value = event.target.type === 'file' ? event.target.files[0] : event.target.value;

    setFormData({
      ...formData,
      [event.target.name]: value
    });
  }


  const validatez0 = () => {
    // check if pose parameters are all complete
    return cameraConfig?.gcps?.z_0;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    try {
      const crossSectionData = await loadFile();
      // Additional steps after successful file load
      console.log("processing cross section data...")
      if (formData.name) {
        const updatedFormSubmitData = {
          name: formData.name,
          features: crossSectionData.features,
        };
        await api.post('/cross_section/', updatedFormSubmitData);
        setMessageInfo('success', 'Successfully created cross section');
        // refresh the cross section data
        fetchCrossSections();

      }
    } catch (error) {
      console.log("File loading not successful, do nothing...", error);
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
        setMessageInfo('success', 'Successfully uploaded CSV file');
        return response.data;
      } catch (csvError) {
        try {
          const geoJsonResponse = await api.post(
            '/cross_section/from_geojson/',
            fileFormData,
            {headers: {"Content-Type": "multipart/form-data"}}
          );

          setMessageInfo('success', 'Successfully uploaded GeoJSON file');
          return geoJsonResponse.data;
        } catch (geoJsonError) {
          throw new Error(`Failed to parse file as CSV (${csvError.response.data.detail}) or as GeoJSON (${geoJsonError.response.data.detail})`);
        }
      }
    } catch (error) {
      console.error("Error occurred during file upload:", error);
      setMessageInfo('error', `Error: ${error.response?.data?.detail || error.message}`);
      throw error;  // error outside this function
    }
  }

  return (
    <div className="split-screen" style={{overflow: 'auto'}}>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Upload new cross sections</h5>
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
            Upload
          </button>
        </form>
      </div>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Select discharge cross section</h5>

        <div className='mb-3 mt-3'>
          <label htmlFor='z_0' className='form-label small'>
            Water level in GCP coordinate system [m]
          </label>
          <input
            type='number' className='form-control'
            id='z_0' name='z_0'
            step={0.01}
            onChange={handleWaterLevelChange}
            value={cameraConfig?.gcps?.z_0 ? cameraConfig.gcps.z_0 : ''}
            // disabled={!validatePose()}
          />
        </div>

        <div className='mb-3 mt-3'>
          <label htmlFor='h_ref' className='form-label small'>
            Water level in local gauge reference [m]. Only set this if you plan to process several videos with different locally measured water levels.
          </label>
          <input
            type='number' className='form-control'
            id='h_ref' name='h_ref'
            step={0.01}
            onChange={handleWaterLevelChange}
            value={cameraConfig?.gcps?.h_ref ? cameraConfig.gcps.h_ref : ''}
            disabled={!validatez0()}
          />
        </div>
        <div className='container' style={{marginTop: '5px'}}>
          <h5>Select discharge cross section</h5>
          <DropdownMenu
            dropdownLabel="Discharge cross section"
            name="discharge"
            callbackFunc={(event) => handleCS(event, setCSDischarge)}
            data={availableCrossSections}
            value={CSDischarge.id}
            disabled={!cameraConfig?.gcps?.z_0}  // only enable when a water level is set
          />
        </div>
        <div className='container' style={{marginTop: '5px'}}>
          <h5>Select optical water level cross section</h5>
          <DropdownMenu
            dropdownLabel="Optical water level cross section"
            name="water level"
            callbackFunc={(event) => handleCS(event, setCSWaterLevel)}
            data={availableCrossSections}
            value={CSWaterLevel.id}
            disabled={!cameraConfig?.gcps?.z_0}  // only enable when a water level is set
          />
        </div>

      </div>
    </div>

  )

};

export default CrossSectionForm;
