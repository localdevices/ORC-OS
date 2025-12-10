import api from "../../api/api.js";

export const patchTimeSeries = async (timeSeries) => {
  try {
    const { id, ...tsPatch } = timeSeries;
    const response = await api.patch(`/time_series/${id}/`, tsPatch)
    return response.data;
  } catch (error) {
    console.log(error);
  }
}
