import api from "../../api/api.js";
import React, {useEffect, useRef, useState} from "react";
import {DropdownMenu} from "../../utils/dropdownMenu.jsx";
import {useDebouncedWsSender} from "../../api/api.js";
import CrossSectionUploadModal from "./crossSectionUploadModal.jsx";
import PropTypes   from "prop-types";

const CrossSectionForm = (
  {
    cameraConfig,
    CSDischarge,
    CSWaterLevel,
    bboxSelected,
    setCameraConfig,
    setCSDischarge,
    setCSWaterLevel,
    setBboxSelected,
    handleBboxStart,
    setMessageInfo,
    ws
  }
) => {

  const [availableCrossSections, setAvailableCrossSections] = useState([]);
  const [showCrossSectionUploadModal, setShowCrossSectionUploadModal] = useState(false);
  const prevCameraConfig = useRef(cameraConfig);


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

  const validateBboxReady = () => {
    // check if all fields are complete for defining a bounding box
    const fieldsComplete = (
      cameraConfig?.gcps?.z_0 &&
      cameraConfig?.f && cameraConfig?.k1 &&
      cameraConfig?.k2 &&
      cameraConfig?.camera_rotation &&
      cameraConfig?.camera_position
    );

    if (!fieldsComplete) {
      return false;
    }
    if (prevCameraConfig.current !== cameraConfig) {
      prevCameraConfig.current = cameraConfig;
      // check if water level values are realistic
      if (cameraConfig?.gcps?.control_points?.length > 0) {
        const avgZ = cameraConfig.gcps.control_points.reduce((sum, point) => sum + point.z, 0) /
          cameraConfig.gcps.control_points.length;
        const zDiff = (avgZ - cameraConfig?.gcps?.z_0);
        if (zDiff < 0) {
          setMessageInfo("warning", `The set water level is ${Math.abs(zDiff).toFixed(2)} above the average height of the control points suggesting all control points are submerged. Is this correct?`)
        } else if (zDiff > 20) {
          setMessageInfo("warning", `The set water level is ${zDiff.toFixed(2)} meters different from the average height of the control points. This may not be realistic.`)
        } else {
          setMessageInfo("success", "Validated set water level")
        }
      }
    }
    return true;
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
      op: 'update_water_level',
      params: {z_0: z_0, h_ref: h_ref},
    });
  }


  const validatez0 = () => {
    // check if pose parameters are all complete
    return cameraConfig?.gcps?.z_0;
  }


  return (
    <div className="split-screen" style={{overflow: 'auto'}}>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Set water levels</h5>
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
        <span
          title={validateBboxReady(cameraConfig, setMessageInfo) ? "Draw Bounding Box" : "you must set water levels first"}
          className="d-inline-block"
          data-bs-toggle="tooltip"
        >
        <button
          className='btn'
          onClick={() => handleBboxStart()}
          disabled={!validateBboxReady(cameraConfig, setMessageInfo)}
        >
          Draw bounding box
        </button>
          </span>

      </div>
      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Cross sections</h5>
        <button className='btn' onClick={() => setShowCrossSectionUploadModal(true)}>
          Upload new
        </button>
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
      {showCrossSectionUploadModal && (
        <CrossSectionUploadModal
          setShowModal={setShowCrossSectionUploadModal}
          setMessageInfo={setMessageInfo}
          callback={fetchCrossSections}
          ws={ws}
        />

      )}
    </div>

  )

};

CrossSectionForm.propTypes = {
  cameraConfig: PropTypes.object.isRequired,
  crossSection: PropTypes.object,
  CSDischarge: PropTypes.object.isRequired,
  CSWaterLevel: PropTypes.object.isRequired,
  bboxSelected: PropTypes.bool,
  setCameraConfig: PropTypes.func.isRequired,
  setCrossSection: PropTypes.func.isRequired,
  setCSDischarge: PropTypes.func.isRequired,
  setCSWaterLevel: PropTypes.func.isRequired,
  setBboxSelected: PropTypes.func.isRequired,
  handleBboxStart: PropTypes.func.isRequired,
  setMessageInfo: PropTypes.func.isRequired,
  ws: PropTypes.object.isRequired,
};

export default CrossSectionForm;
