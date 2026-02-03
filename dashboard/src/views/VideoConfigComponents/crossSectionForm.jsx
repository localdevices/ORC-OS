import api from "../../api/api.js";
import {useEffect, useState} from "react";
import {DropdownMenu} from "../../utils/dropdownMenu.jsx";
import {useDebouncedWsSender} from "../../api/api.js";

import PropTypes   from "prop-types";
const CrossSectionForm = (
  {
    cameraConfig,
    CSDischarge,
    CSWaterLevel,
    setCameraConfig,
    setCSDischarge,
    setCSWaterLevel,
    setMessageInfo,
    ws
  }
) => {
  // form data as the user sees it on the screen
  const [formData, setFormData] = useState({
    name: '',
    file: null
  });

  const [availableCrossSections, setAvailableCrossSections] = useState([]);
  const sendDebouncedMsg = useDebouncedWsSender(ws, 400);

  const fetchCrossSections = async () => {
    try {
      const response = await api.get('/cross_section/');
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
    console.log(value);
    // if (value) {
      // try {
    const msg = {
      "action": "update_video_config",
      "op": "update_cross_section",
      "params": name === "discharge"
        ? {"cross_section_id": value ? parseInt(value) : 0}
        : {"cross_section_wl_id": value ? parseInt(value) : 0}
      }
      sendDebouncedMsg(msg)

      //   const response = await api.post(
      //     `cross_section/${value}/camera_config/?${new Date().getTime()}`,
      //     cameraConfig
      //   );
      //   if (!response.data.within_image) {
      //     setMessageInfo('error', `${nameCapitalize} cross section is not within the image`)
      //   } else if (response.data.distance_camera > 1000) {
      //     setMessageInfo('error', `${nameCapitalize} cross section is too far away from the camera (> 1000 m.)`)
      //   } else {
      //     // TODO: replace by ws.sendJson call
      //     setter(response.data);
      //     console.log(response.data);
      //     setMessageInfo('success', `Successfully set ${name} cross section to ID ${value}`)
      //   }
      // } catch (error) {
      //   console.log(error);
      //   setMessageInfo('error', `Failed to fetch ${name} cross section: ${error.response.data.detail || error.message}`)
      // }
    // } else {
    //   setter({});
    //   setMessageInfo('success', `Successfully removed ${name} cross section`)
    // }
  }

  const handleWaterLevelChange = async (event) => {
    const {name, value} = event.target;
    let z_0, h_ref;
    let inputValue = value === '' ? '' : value; // Accept empty string or value directly
    // check if h_ref is empty and if z_0 exists
    if (name === "z_0") {
      z_0 = inputValue === '' ? null : parseFloat(value);
      if (cameraConfig?.data?.gcps?.h_ref === null || cameraConfig?.data?.gcps?.h_ref === undefined) {
        h_ref = z_0;
      } else {
        h_ref = cameraConfig?.data?.gcps?.h_ref;
      }
    } else {
      h_ref = inputValue === '' ? cameraConfig.gcps.z_0 : parseFloat(value);
      z_0 = cameraConfig.gcps.z_0 ?? null;
    }
    const updateCameraConfig = {
      gcps: {
        ...cameraConfig.gcps,
        z_0: z_0,
        h_ref: h_ref
      }
    }
    // update immediately for snappy UI
    const newConfig = (prevConfig) => {
      return {
        ...prevConfig,
        ...updateCameraConfig
      }
    }
    setCameraConfig(newConfig);
    // send update to back end
    const videoPatch = {video_config: {
        camera_config: updateCameraConfig,
      }};

    // send off to back end
    sendDebouncedMsg({
      action: 'update_video_config',
      op: 'set_field',
      params: {video_patch: videoPatch},
    });
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
      <div className='container tab'>
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
            value={cameraConfig?.gcps?.z_0 !== null ? cameraConfig.gcps.z_0 : ''}
            // disabled={!validatePose()}
          />
        </div>

        <div className='mb-3 mt-3'>
          <label htmlFor='h_ref' className='form-label small'>
            Water level in local gauge reference [m]. Defaults to GCP coordinate. Only set this if you plan to process several videos with different locally measured water levels.
          </label>
          <input
            type='number' className='form-control'
            id='h_ref' name='h_ref'
            step={0.01}
            onChange={handleWaterLevelChange}
            value={cameraConfig?.gcps?.h_ref !== null ? cameraConfig.gcps.h_ref : ''}
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
            value={CSDischarge?.id}
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
            value={CSWaterLevel?.id}
            disabled={!cameraConfig?.gcps?.z_0}  // only enable when a water level is set
          />
        </div>

      </div>
    </div>

  )

};

CrossSectionForm.propTypes = {
  cameraConfig: PropTypes.object.isRequired,
  crossSection: PropTypes.object,
  CSDischarge: PropTypes.object.isRequired,
  CSWaterLevel: PropTypes.object.isRequired,
  setCameraConfig: PropTypes.func.isRequired,
  setCrossSection: PropTypes.func.isRequired,
  setCSDischarge: PropTypes.func.isRequired,
  setCSWaterLevel: PropTypes.func.isRequired,
  setMessageInfo: PropTypes.func.isRequired,
};

export default CrossSectionForm;
