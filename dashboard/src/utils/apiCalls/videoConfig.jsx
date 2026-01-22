import api from "../../api/api.js";

export const fitGcps = async (imgDims, gcps, setMessageInfo) => {
  try {
    const response = await api.post('/control_points/fit_perspective', {
      "gcps": gcps,
      "height": imgDims.height,
      "width": imgDims.width,
    });
    // Extract `src_est` and `dst_est` from API response
    // const { error } = response.data;
    //
    // const err_round = Math.round(error * 1000) / 1000;
    // if (err_round > 0.1) {
    //   setMessageInfo('warning', `GCPs successfully fitted, but with a large average error: ${err_round} m.`);
    // }
    // setMessageInfo('success', `GCPs successfully fitted to image, average error: ${err_round} m.`);
    console.log(response.data);
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
