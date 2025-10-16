// status icons
import {
  FaSync,
  FaSpinner,
  FaCheck,
  FaTimes,
  FaStar,
  FaHourglass,
} from "react-icons/fa";

// camera icons for video config
import {TbCameraCancel, TbCameraCheck, TbCameraPin} from "react-icons/tb";

export const getStatusIcon = (status) => {
  switch (status) {
    case 3:
      return <div><FaSpinner style={{color: "blue", animation: "spin 1s linear infinite"}}/> running</div>// Spinner for processing
    case 4:
      return <div><FaCheck style={{color: "green"}}/> done</div>; // Success
    case 5:
      return <div><FaTimes style={{color: "red"}}/> error</div>; // Error
    case 1:
      return <div><FaStar style={{color: "gold"}}/> new</div>; // Warning
    case 2:
      return <div><FaHourglass style={{color: "purple"}}/> queue</div>; // Pending
    default:
      return <FaSpinner style={{color: "gray", animation: "spin 1s linear infinite"}}/>; // Default spinner
  }
};
export const getSyncStatusIcon = (status) => {
  switch (status) {
    case 1:
      return <div><FaSync style={{color: "grey"}}/> not synced</div>
    case 2:
      return <div><FaCheck style={{color: "green"}}/> done</div>; // Success
    case 3:
      return <div><FaSync style={{color: "cadetblue", animation: "spin 1s linear infinite"}}/> out of sync</div>; // Error
    default:
      return <FaSync style={{color: "grey"}}/>;
  }
};
export const getVideoConfigIcon = (video) => {
  // If video_config is not present
  if (!video.video_config) {
    return (
      <TbCameraCancel
        style={{color: "red"}}
        size={20}
        className="pulsating-icon"
      />
    );
  }

  // If video_config.sample_video_id matches video.id
  if (video.video_config.sample_video_id === video.id && video.video_config.ready_to_run) {
    return (
      <TbCameraPin
        style={{color: "blue"}}
        size={20}
        className="btn-icon"
      />
    );
  }
  if (video.video_config.sample_video_id === video.id) {
    return (
      <TbCameraPin
        style={{color: "orange"}}
        size={20}
        className="pulsating-icon"
      />
    );
  }
  // Catch-all case for video_config
  return (
    <TbCameraCheck
      style={{color: "green"}}
      size={20}
      className="btn-icon"
    />
  );
};

export const getVideoConfigTitle = (video) => {
  // If video_config is not present
  if (!video.video_config) {
    return "No video configuration is set. Click to select an existing video configuration or create a new one based on this video, if it contains control point information."

  }
  // If video_config.sample_video_id matches video.id
  if (video.video_config.sample_video_id === video.id && video.video_config.ready_to_run) {
    return "This video acts as a reference video for a video configuration and is ready to use. Click to change video configuration."
  }
  if (video.video_config.sample_video_id === video.id) {
    return "This video acts as a reference video for a video configuration and is not ready to use. Click to finish video configuration."
  }
  return "This video has another video as a reference video. Click to change that video configuration."
}
