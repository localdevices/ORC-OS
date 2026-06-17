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
  });

  const wsRef = useRef(null);

  // Initialize WebSocket
  useEffect(() => {
    if (!videoId) return;

    const connectionId = `video_${videoId}_frame_stream`;
    const callbackVideoPlayerStates = (message, ws) => {
      if (message.type === "state") {
        setState((prev) => ({
          ...prev,
          current_frame: message.current_frame,
          total_frames: message.total_frames,
          is_playing: message.is_playing,
        }));
      };
    }

    const ws = createWebSocketConnection(
      connectionId,
      `/video/${videoId}/frames_interactive/`,
      callbackVideoPlayerStates,
      true,
    );
    wsRef.current = ws;

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send stop command before closing for graceful shutdown
        try {
          ws.send(
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
          if (ws.readyState === WebSocket.OPEN) {
            ws.close(1000, "Component unmounting");
          }
        }, 100);
      }
    };
  }, [videoId]);

  // Send command to backend
  const sendCommand = useCallback((command, params = {}) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "command",
          command,
          ...params,
        })
      );
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
