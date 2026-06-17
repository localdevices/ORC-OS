import PropTypes from "prop-types";
import api, {createWebSocketConnection} from "../api/api.js";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { createDebounce } from "./helpers.jsx";

// Check if an image URL is already cached by the browser
export const isImageCached = (url) => {
  const img = new Image();
  img.src = url;
  return img.complete;
};

// Build the frame URL for playing a given video with given rotation as MJPEG stream
export const getFrameUrl = (video, rotate) => {
  if (!video) return "";
  const apiHost = api.defaults.baseURL.replace(/\/$/, "");
  const frameUrl = `${apiHost}/video/${String(video.id)}/frames_with_state/`;
  const url = rotate !== null && rotate !== undefined ? `${frameUrl}?rotate=${rotate}` : frameUrl;
  console.log(`Constructed frame URL: ${url}`);
  return url;
};


/**
 * Hook for interactive frame streaming via WebSocket
 * @param {number} videoId - The video ID to stream
 * @param {function} onFrameUpdate - Callback when frame updates
 * @returns {object} State and control methods
 */

export const useInteractiveFrameStream = (videoId) => {
  const [state, setState] = useState({
    current_frame: 0,
    total_frames: 0,
    is_playing: false,
    isReady: false,  // Add ready flag
    error: null,     // Add error state
  });

  const wsRef = useRef(null);
  const callbackRef = useRef(null);

  // Initialize WebSocket
  useEffect(() => {
    if (!videoId) {
      setState((prev) => ({ ...prev, isReady: false, error: "No video ID provided" }));
      return;
    }

    const connectionId = `video_${videoId}_frame_stream`;

    // Define callback BEFORE creating the connection
    const callbackVideoPlayerStates = (message, ws) => {
      try {
        if (message.type === "state" || message.type === "heartbeat") {
          setState((prev) => ({
            ...prev,
            current_frame: message.current_frame ?? prev.current_frame,
            total_frames: message.total_frames ?? prev.total_frames,
            is_playing: message.is_playing ?? prev.is_playing,
            isReady: true,  // Mark as ready once we get first state
            error: null,
          }));
        }
      } catch (e) {
        console.error("Error processing WebSocket message:", e);
        setState((prev) => ({ ...prev, error: e.message }));
      }
    };

    callbackRef.current = callbackVideoPlayerStates;

    try {
      const ws = createWebSocketConnection(
        connectionId,
        `/video/${videoId}/frames_interactive/`,
        callbackVideoPlayerStates,
        true,
      );
      wsRef.current = ws;

      // Add onopen handler to log successful connection
      const originalOnopen = ws.onopen;
      ws.onopen = () => {
        console.log(`WebSocket for video ${videoId} connected`);
        if (originalOnopen) originalOnopen();
      };

      // Add onerror handler
      const originalOnerror = ws.onerror;
      ws.onerror = (event) => {
        console.error(`WebSocket error for video ${videoId}:`, event);
        setState((prev) => ({ ...prev, error: "WebSocket connection failed" }));
        if (originalOnerror) originalOnerror(event);
      };
    } catch (e) {
      console.error(`Failed to create WebSocket for video ${videoId}:`, e);
      setState((prev) => ({ ...prev, error: e.message }));
    }

    return () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        // Send stop command before closing for graceful shutdown
        try {
          wsRef.current.send(
            JSON.stringify({
              type: "command",
              command: "stop",
            })
          );
        } catch (e) {
          console.warn("Failed to send stop command:", e);
        }
        // Give server time to process the stop command before closing
        setTimeout(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.close(1000, "Component unmounting");
          }
        }, 100);
      }
    };
  }, [videoId]);

  // Send command to backend
  const sendCommand = useCallback((command, params = {}) => {
    if (!wsRef.current) {
      console.warn(`WebSocket not initialized for command: ${command}`);
      return;
    }

    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn(`WebSocket not open (state=${wsRef.current.readyState}) for command: ${command}`);
      return;
    }

    try {
      wsRef.current.send(
        JSON.stringify({
          type: "command",
          command,
          ...params,
        })
      );
    } catch (e) {
      console.error(`Failed to send command ${command}:`, e);
    }
  }, []);

  return {
    ...state,
    play: () => sendCommand("play"),
    pause: () => sendCommand("pause"),
    seek: (frame) => sendCommand("seek", { frame }),
    forward: () => sendCommand("forward"),
    rewind: () => sendCommand("rewind"),
    setRotate: (rotate) => sendCommand("set_rotate", { rotate }),
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
