import PropTypes from "prop-types";
import api, {createWebSocketConnection} from "../api/api.js";
import {getFrameCount} from "./apiCalls/video.jsx";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createDebounce } from "./helpers.jsx";

// Check if an image URL is already cached by the browser
export const isImageCached = (url) => {
  const img = new Image();
  img.src = url;
  return img.complete;
};

// Build the frame URL for playing a given video with given rotation as MJPEG stream
export const getFrameUrl = (video, frameNr, rotate) => {
  if (!video) return "";
  const apiHost = api.defaults.baseURL.replace(/\/$/, "");
  const frameUrl = `${apiHost}/video/${String(video.id)}/frame/${String(frameNr)}`;
  const url = rotate !== null && rotate !== undefined ? `${frameUrl}?rotate=${rotate}` : frameUrl;
  return url;
};


/**
 * Hook for interactive frame streaming via WebSocket
 * @param {number} videoId - The video ID to stream
 * @param {function} onFrameUpdate - Callback when frame updates
 * @returns {object} State and control methods
 */

export const useInteractiveVideoControls = (videoId) => {
  const [state, setState] = useState({
    current_frame: 0,
    total_frames: 0,
  });


  // define controls here
  const seek = (frame) => {
    // only make sure the frame is not out of bounds
    if (frame < 0) {
      setState((prev) =>({
        ...prev,
        current_frame: 0,
      }));
    } else if (frame >= state.total_frames) {
      setState((prev) =>({
        ...prev,
        current_frame: prev.total_frames - 1,
      }));
    } else {
      setState((prev) =>({
        ...prev,
        current_frame: frame,
      }));
    }
    return;
  };

  const forward = () => {
    // move one frame forward, or move to start when end is reached
    if (state.current_frame >= state.total_frames - 1) {
      // at the end of video, move to start of video
      setState((prev) =>({
        ...prev,
        current_frame: 0,
      }));
    } else {
      setState((prev) =>({
        ...prev,
        current_frame: state.current_frame + 1,
      }));
    }
    return;
  };

  const rewind = () => {
    // move one frame backward, or move to end when start is reached
    if (state.current_frame <= 0) {
      // at the start of video, move to end of video
      setState((prev) =>({
        ...prev,
        current_frame: prev.total_frames - 1,
      }));
    } else {
      setState((prev) =>({
        ...prev,
        current_frame: state.current_frame - 1,
      }));
    }
    return;
  };

  // at mounting and change of videoId, fetch total frames from backend
  useEffect(() => {
    if (!videoId) {
      return;
    }
      // Reset current_frame and fetch total frames
    setState((prev) => ({
      ...prev,
      current_frame: 0,  // Reset frame when video changes
      total_frames: 0,   // Clear total until loaded
    }));
    // Fetch total frames from backend when videoId changes
    const fetchTotalFrames = async () => {
      try {
        const response = await getFrameCount(videoId);
        setState((prev) => ({
          ...prev,
          total_frames: response,
        }));
      } catch (error) {
        console.error(error);
      }
    };
  fetchTotalFrames();

  }, [videoId]);

  return {
    ...state,
    // play: () => sendCommand("play"),
    // pause: () => sendCommand("pause"),
    seek: (frame) => seek(frame),
    forward: () => forward(),
    rewind: () => rewind(),
    setRotate: (rotate) => setRotate(rotate),
  };
};


export const useDebouncedImageUrl = ({
  setImageUrl,
  deps,
  urlBuilder,
  onUrlReady,
  delayMs = 300
}) => {
  const debounced = useMemo(
    () =>
      createDebounce(() => {
        const url = urlBuilder();
        setImageUrl(url);
        if (onUrlReady && url) {
          onUrlReady(url, { cached: isImageCached(url) });
        }
      }, delayMs),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setImageUrl, urlBuilder, delayMs]
  );

  useEffect(() => {
    debounced();
    return () => {
      debounced.cancel && debounced.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
};

export const PolygonDrawer = ({
  points,
  fill = "rgba(255, 255, 255, 0.3)",
  stroke = "white",
  strokeWidth = 2,
  zIndex = 1,
  visible = true,
}) => {
  if (!visible || !points || points.length === 0) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex,
      }}
    >
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <polygon
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      </svg>
    </div>
  );
};

PolygonDrawer.propTypes = {
  points: PropTypes.arrayOf(
    PropTypes.shape({
      x: PropTypes.number.isRequired,
      y: PropTypes.number.isRequired,
    })
  ),
  fill: PropTypes.string,
  stroke: PropTypes.string,
  strokeWidth: PropTypes.number,
  zIndex: PropTypes.number,
  visible: PropTypes.bool,
};
