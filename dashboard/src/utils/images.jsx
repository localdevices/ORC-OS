import PropTypes from "prop-types";

import api from "../api/api.js";
import { useEffect, useMemo } from "react";

// Simple debounce utility returning a stable debounced function
export const createDebounce = (callback, delay) => {
  let timeout;
  const debounced = (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => callback(...args), delay);
  };
  // return a cancel function to clear the timeout
  debounced.cancel = () => clearTimeout(timeout);
  return debounced;
};

// Check if an image URL is already cached by the browser
export const isImageCached = (url) => {
  const img = new Image();
  img.src = url;
  return img.complete;
};

// Build the frame URL for a given video/frame/rotate
export const getFrameUrl = (video, frameNr, rotate) => {
  if (!video) return "";
  const apiHost = api.defaults.baseURL.replace(/\/$/, "");
  const frameUrl = `${apiHost}/video/${String(video.id)}/frame/${String(frameNr)}`;
  return rotate !== null && rotate !== undefined ? `${frameUrl}?rotate=${rotate}` : frameUrl;
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
  // scale = 1,
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
  scale: PropTypes.number,
  zIndex: PropTypes.number,
  visible: PropTypes.bool,
};
