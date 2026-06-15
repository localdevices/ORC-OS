import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useInteractiveFrameStream } from "./images.jsx";

const FrameControls = (
  {
    totalFrames,
    currentFrame,
    isPlaying,
    play,
    pause,
    seek,
    forward,
    rewind
  }
) => {
    const [sliderValue, setSliderValue] = useState(currentFrame);

  useEffect(() => {
    setSliderValue(currentFrame);
  }, [currentFrame]);


    return (
        <div className="frame-controls frame-control-bar">
            {/* Frame Slider */}
            <input
                type="range"
                min="0"
                max={totalFrames - 1}
                value={sliderValue}
                onChange={(e) => setSliderValue(Number.parseInt(e.target.value))}
                onMouseUp={(e) => seek(Number.parseInt(e.target.value))}
                onTouchEnd={(e) => seek(Number.parseInt(e.target.value))}
                className="frame-slider"
            />
            <span className="frame-label">
                {sliderValue + 1}/{totalFrames}
            </span>

            {/* Control Buttons */}
            <div className="control-btn-group">
                <button
                onClick={rewind}
                className="control-btn"
                >
                ⏮
                </button>
                <button
                onClick={play}
                disabled={isPlaying}
                className="control-btn"
                >
                ▶
                </button>
                <button
                onClick={pause}
                disabled={!isPlaying}
                className="control-btn"
                >
                ⏸
                </button>
                <button
                onClick={forward}
                className="control-btn"
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
    isPlaying: PropTypes.bool.isRequired,
    play: PropTypes.func.isRequired,
    pause: PropTypes.func.isRequired,
    seek: PropTypes.func.isRequired,
    forward: PropTypes.func.isRequired,
    rewind: PropTypes.func.isRequired
}
