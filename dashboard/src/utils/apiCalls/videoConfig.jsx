import api from "../../api/api.js";

export const fitGcps = async (imgDims, gcps, distCoeffs, setMessageInfo) => {
  try {
    const response = await api.post('/control_points/fit_perspective', {
      "gcps": gcps,
      "height": imgDims.height,
      "width": imgDims.width,
      "distCoeffs": distCoeffs,
    });
    return response.data;

  } catch (error) {
    // setMessageInfo('error', 'Failed to send coordinates:' + error.response.data.detail);
    console.error(error.response.data.detail);
    return;
  }
};

export const get_bbox = async (cameraConfig, points) => {
  try {
    const response = await api.post(
      "/camera_config/bounding_box",
      {
        "camera_config": cameraConfig,
        "points": points,
      }
    )
    return response.data;
  } catch (error) {
    console.log(error);
  }
}
