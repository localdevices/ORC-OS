import { useRef } from 'react';
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

import './photoComponent.css';
import {useMessage} from "../../messageContext.jsx";


const ControlPanel = ({ onRotateLeft, onRotateRight, onBoundingBox, onMove, cameraConfig, bboxSelected }) => {
  const prevCameraConfig = useRef(cameraConfig);
  // allow for setting messages
  const {setMessageInfo} = useMessage();

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
          setMessageInfo("success", `Your camera calibration is now set. You can continue drawing a bounding box in the Image View`)
        }
      }
    }
    return true;
  }

  return (
    <div className="control-styles">
      <div className="button-group-styles">
        <button className="button-styles"
          onClick={() => onRotateLeft()}
          title="Rotate bounding box left"
          disabled

        >
          <MdRotateLeft size={20} />
        </button>
        <button className="button-styles"
          onClick={() => onRotateRight()}
          title="Rotate bounding box right"
          disabled
        >
          <MdRotateRight size={20} />
        </button>
        <button className={`button-styles ${bboxSelected ? 'selected-bbox' : ''}`}
          onClick={() => onBoundingBox()}
          title="Draw Bounding Box (you must validate control points and set water level first)"
          disabled={!validateBboxReady()}

        >
          <MdCropFree size={20} />
        </button>
      </div>
      <div className="button-group-styles">
        <button className="button-styles"
          onClick={() => onMove('up')}
          title="Move bounding box up"
          disabled
        >
          <MdArrowUpward size={20} />
        </button>
        <button className="button-styles"
          onClick={() => onMove('left')}
          title="Move bounding box left"
          disabled
        >
          <MdArrowBack size={20} />
        </button>
        <button className="button-styles"
          onClick={() => onMove('right')}
          title="Move bounding box right"
          disabled
        >
          <MdArrowForward size={20} />
        </button>
        <button className="button-styles"
          onClick={() => onMove('down')}
          title="Move bounding box down"
          disabled
        >
          <MdArrowDownward size={20} />
        </button>
      </div>
    </div>
  );
};
export default ControlPanel;
