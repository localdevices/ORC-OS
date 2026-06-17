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
    setSliderValue(currentFrame + 1);  // we count for the user starting at 1 instead of zero
  }, [currentFrame]);


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
            />
            <span className="frame-label">
                {sliderValue}/{totalFrames}
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
