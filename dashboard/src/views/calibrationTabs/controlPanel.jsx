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

const ControlPanel = ({ onRotateLeft, onRotateRight, onBoundingBox, onMove }) => {


  return (
    <div className="control-styles">
      <div className="button-group-styles">
        <button className="button-styles"
          onClick={() => onRotateLeft()}
          title="Rotate video left"
        >
          <MdRotateLeft size={20} />
        </button>
        <button className="button-styles"
          onClick={() => onRotateRight()}
          title="Rotate video right"
        >
          <MdRotateRight size={20} />
        </button>
        <button className="button-styles"
          onClick={() => onBoundingBox()}
          title="Draw Bounding Box (calibrate video first with control points!)"
          disabled
        >
          <MdCropFree size={20} />
        </button>
      </div>
      <div className="button-group-styles">
        <button className="button-styles"
          onClick={() => onMove('up')}
          title="Move bounding box up"
        >
          <MdArrowUpward size={20} />
        </button>
        <button className="button-styles"
          onClick={() => onMove('left')}
          title="Move bounding box left"
        >
          <MdArrowBack size={20} />
        </button>
        <button className="button-styles"
          onClick={() => onMove('right')}
          title="Move bounding box right"
        >
          <MdArrowForward size={20} />
        </button>
        <button className="button-styles"
          onClick={() => onMove('down')}
          title="Move bounding box down"
        >
          <MdArrowDownward size={20} />
        </button>
      </div>
    </div>
  );
};
export default ControlPanel;
