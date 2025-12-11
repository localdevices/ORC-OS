import api from "../../api/api.js";

export const getWettedSurface = async (crossSectionId, cameraConfigId, h = 0, camera = true) => {
  try {
    const response = await api.get(
      `/cross_section/${crossSectionId}/wetted_surface/`,
      {params: {camera_config_id: cameraConfigId, camera: camera, h: h}}
    )
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export const getWaterLines = async (crossSectionId, cameraConfigId, h = 0, camera = true) => {
  try {
    const response = await api.get(
      `/cross_section/${crossSectionId}/csl_water_lines/`,
      {params: {camera_config_id: cameraConfigId, camera: camera, h: h}}
    )
    return response.data;
  } catch (error) {
    console.error(error);
  }
}
