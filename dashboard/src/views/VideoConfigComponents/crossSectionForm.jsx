import api from "../../api/api.js";
import React, {useEffect, useRef, useState} from "react";
import {FaExclamationTriangle} from 'react-icons/fa';
import {DropdownMenu} from "../../utils/dropdownMenu.jsx";
import {useDebouncedWsSender} from "../../api/api.js";
import CrossSectionUploadModal from "./crossSectionUploadModal.jsx";
import PropTypes   from "prop-types";
import { convertWaterLevel, convertWaterLevelToMetric, getWaterLevelUnit } from "../../utils/unitConversions.js";

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
    handleEstimateBbox,
    setMessageInfo,
    ws
  }
) => {

  const [availableCrossSections, setAvailableCrossSections] = useState([]);
  const [showCrossSectionUploadModal, setShowCrossSectionUploadModal] = useState(false);
  const [h_refUnit, setH_refUnit] = useState('metric'); // 'metric' or 'imperial'
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
  }

  const validateBboxReady = () => {
    // check if all fields are complete for defining a bounding box
    // also a Discharge cross section must be selected.
    const fieldsComplete = (
      cameraConfig?.gcps?.z_0 &&
      cameraConfig?.f && cameraConfig?.k1 &&
      cameraConfig?.k2 &&
      cameraConfig?.camera_rotation &&
      cameraConfig?.camera_position &&
      CSDischarge
    );

    if (!fieldsComplete) {
      return false;
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
      // For h_ref: convert from imperial to metric if needed before storing
      const parsedValue = inputValue === '' ? null : parseFloat(value);
      h_ref = parsedValue === null ? null : (h_refUnit === 'imperial' ? convertWaterLevelToMetric(parsedValue) : parsedValue);
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
          <p className="icon-warning"><FaExclamationTriangle color="orange"/><i>The water level in GCP coordinate system is also in meters.</i></p>
          <label htmlFor='z_0' className='form-label small'>
            Water level in GCP coordinate system [m].
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
            Water level in local gauge reference [{h_refUnit === 'metric' ? 'm' : 'ft'}]. Defaults to GCP coordinate.
            You may set this in feet if desired. When collecting water levels for new videos, these must be collected
            with the same vertical datum as used here.
          </label>
          <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
            <input
              type='number' className='form-control'
              id='h_ref' name='h_ref'
              step={0.01}
              onChange={handleWaterLevelChange}
              value={
                cameraConfig?.gcps?.h_ref !== null && cameraConfig?.gcps?.h_ref !== undefined
                  ? h_refUnit === 'imperial'
                    ? convertWaterLevel(cameraConfig.gcps.h_ref, 'imperial')
                    : cameraConfig.gcps.h_ref
                  : ''
              }
              disabled={!validatez0()}
              style={{flex: 1}}
            />
            <select
              className='form-control'
              value={h_refUnit}
              onChange={(e) => setH_refUnit(e.target.value)}
              style={{flex: '0 0 auto', width: '100px'}}
              disabled={!validatez0()}
            >
              <option value='metric'>Meters</option>
              <option value='imperial'>Feet</option>
            </select>
          </div>
        </div>
      </div>

      <div className='container' style={{marginTop: '5px', overflow: 'auto'}}>
        <h5>Cross sections</h5>
        <button className='btn btn-primary' onClick={() => setShowCrossSectionUploadModal(true)}>
          Upload new
        </button>
        <div className='container' style={{marginTop: '5px'}}>
          <h5>Select cross sections</h5>
          <DropdownMenu
            dropdownLabel="For discharge"
            name="discharge"
            callbackFunc={(event) => handleCS(event, setCSDischarge)}
            data={availableCrossSections}
            value={CSDischarge?.id}
            disabled={!cameraConfig?.gcps?.z_0}  // only enable when a water level is set
          />
          <DropdownMenu
            dropdownLabel="For optical water level"
            name="water level"
            callbackFunc={(event) => handleCS(event, setCSWaterLevel)}
            data={availableCrossSections}
            value={CSWaterLevel?.id}
            disabled={!cameraConfig?.gcps?.z_0}  // only enable when a water level is set
          />
        </div>
                <span
          title={validateBboxReady() ? "Automatically estimate bounding box around cross section" : "you must set water levels and a discharge cross section first"}
          className="d-inline-block"
          data-bs-toggle="tooltip"
        >
        <button
          className='btn btn-primary'
          onClick={() => handleEstimateBbox()}
          disabled={!validateBboxReady()}
        >
          Estimate bounding box
        </button>
        </span>
        <span
          title={validateBboxReady() ? "Manually draw Bounding box around the selected cross section" : "you must set water levels and a discharge cross section first"}
          className="d-inline-block"
          data-bs-toggle="tooltip"
        >
        <button
          className='btn btn-primary'
          onClick={() => handleBboxStart()}
          disabled={!validateBboxReady()}
        >
          Draw bounding box
        </button>
        </span>
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
