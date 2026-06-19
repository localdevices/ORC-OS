import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

const FrameControls = (
  {
    totalFrames,
    currentFrame,
    seek,
    forward,
    rewind,
    isReady = true,  // Default to true for backward compatibility
  }
) => {
    const [sliderValue, setSliderValue] = useState(currentFrame);

  useEffect(() => {
    setSliderValue(currentFrame + 1);  // we count for the user starting at 1 instead of zero
  }, [currentFrame]);

  // Show loading/error state
  if (!isReady) {
    return (
      <div className="frame-controls frame-control-bar">
        <div style={{ color: "orange", fontStyle: "italic" }}>
          {error ? `WebSocket Error: ${error}` : "Connecting to video stream..."}
        </div>
      </div>
    );
  }

  if (totalFrames === 0) {
    return (
      <div className="frame-controls frame-control-bar">
        <div style={{ color: "orange", fontStyle: "italic" }}>
          Waiting for video data...
        </div>
      </div>
    );
  }

    return (
        <div className="frame-controls frame-control-bar">
            {/* Frame Slider */}
            <input
                type="range"
                min="1"
                max={totalFrames}
                value={sliderValue}
                onChange={(e) => setSliderValue(Number.parseInt(e.target.value))}
                onMouseUp={(e) => seek(Number.parseInt(e.target.value) - 1)}
                onTouchEnd={(e) => seek(Number.parseInt(e.target.value) - 1)}
                className="frame-slider"
                disabled={!isReady}
            />
            <span className="frame-label">
                {sliderValue}/{totalFrames}
            </span>

            {/* Control Buttons */}
            <div className="control-btn-group">
                <button
                onClick={rewind}
                className="control-btn"
                disabled={!isReady}
                >
                ⏮
                </button>
                <button
                onClick={forward}
                className="control-btn"
                disabled={!isReady}
                >
                ⏭
                </button>
            </div>
        </div>

    )
}

export default FrameControls;

FrameControls.propTypes = {
    totalFrames: PropTypes.number.isRequired,
    currentFrame: PropTypes.number.isRequired,
    seek: PropTypes.func.isRequired,
    forward: PropTypes.func.isRequired,
    rewind: PropTypes.func.isRequired,
}
