import { useRef } from 'react';
import PropTypes from "prop-types";

// Add this component to your VideoTab return statement, before the TransformWrapper
import {
  MdRotateLeft,
  MdRotateRight,
  MdCropFree,
  MdArrowUpward,
  MdArrowDownward,
  MdArrowBack,
  MdArrowForward
} from 'react-icons/md';

import { IoMdExpand, IoMdContract } from "react-icons/io";

import './photoComponent.css';
import {useMessage} from "../../messageContext.jsx";
import {useDebouncedWsSender} from "../../api/api.js";


const ControlPanel = ({ cameraConfig, bboxSelected, ws }) => {
  const prevCameraConfig = useRef(cameraConfig);
  // allow for setting messages
  const {setMessageInfo} = useMessage();
  const sendDebouncedMsg = useDebouncedWsSender(ws, 100);

  const validateBboxSet = () => {
    // check if a bbox is present in cameraconfig
    return cameraConfig?.bbox !== undefined && cameraConfig?.bbox !== null && cameraConfig?.bbox.length > 0;
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
           setMessageInfo("success", "")
        }
      }
    }
    return true;
  }


  // handle transform effects
  const transformBbox = (params) => {
    const msg = {
      action: "update_video_config",
      op: "rotate_translate_bbox",
      params: params
    }
    sendDebouncedMsg(msg);
  }

  const handleRotateCounterClock = () => {
    const params = {"angle": 0.02}
    transformBbox(params);
  };

  const handleRotateClock = () => {
    const params = {"angle": -0.02}
    transformBbox(params);
  };

  const handleMoveUp = () => {
    const params = {"xoff": -0.1}
    transformBbox(params);
  };

  const handleIncreaseUpDown = () => {
    const params = {"x_add": 0.1}
    transformBbox(params);
  };

  const handleDecreaseUpDown = () => {
    const params = {"x_add": -0.1}
    transformBbox(params);
  };

  const handleMoveDown = () => {
    const params = {"xoff": 0.1}
    transformBbox(params);
  };

  const handleMoveLeft = () => {
    const params = {"yoff": 0.1}
    transformBbox(params);
  };

  const handleMoveRight = () => {
    const params = {"yoff": -0.1}
    transformBbox(params);
  };

  return (
    <div className="control-styles">
      <div className="button-group-styles">
        <button
          className="button-styles"
          onClick={handleRotateCounterClock}
          title="Rotate bounding box counter-clockwise"
          disabled={!validateBboxSet()}
        >
          <MdRotateLeft size={20} />
        </button>
        <button
          className="button-styles"
          onClick={handleRotateClock}
          title="Rotate bounding box clockwise"
          disabled={!validateBboxSet()}
        >
          <MdRotateRight size={20} />
        </button>
        <button
          className="button-styles"
          onClick={handleIncreaseUpDown}
          title="Resize up/downstream"
         disabled={!validateBboxSet()}
        >
          <IoMdExpand style={{"rotate": "45deg"}} size={20} />
        </button>
        <button
          className="button-styles"
          onClick={handleDecreaseUpDown}
          title="Resize up/downstream"
         disabled={!validateBboxSet()}
        >
          <IoMdContract style={{"rotate": "45deg"}} size={20} />
        </button>
      </div>
      <div className="button-group-styles">
        <button
          className="button-styles"
          onClick={handleMoveUp}
          title="Move bounding box upstream"
          disabled={!validateBboxSet()}
        >
          <MdArrowDownward size={20} />
        </button>
        <button
          className="button-styles"
          onClick={handleMoveDown}
          title="Move bounding box downstream"
          disabled={!validateBboxSet()}
        >
          <MdArrowUpward size={20} />
        </button>
        <button
          className="button-styles"
          onClick={handleMoveLeft}
          title="Move bounding box left"
          disabled={!validateBboxSet()}
        >
          <MdArrowBack size={20} />
        </button>
        <button
          className="button-styles"
          onClick={handleMoveRight}
          title="Move bounding box right"
          disabled={!validateBboxSet()}
        >
          <MdArrowForward size={20} />
        </button>
      </div>
    </div>
  );
};
ControlPanel.propTypes = {
  cameraConfig: PropTypes.object.isRequired,
  bboxSelected: PropTypes.bool.isRequired,
};

export default ControlPanel;
