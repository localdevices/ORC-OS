import api from "../../api/api.js";

export const patchTimeSeries = async (timeSeries) => {
  try {
    const { id, ...tsPatch } = timeSeries;
    const response = await api.patch(`/time_series/${id}/`, tsPatch)
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export const postTimeSeries = async (timeSeries) => {
  try {
    const response = await api.post("/time_series/", timeSeries)
    return response.data;
  } catch (error) {
    console.error(error);
  }
}

export const getTimeSeries = async (timeSeriesId) => {
  try {
    const response = await api.get(`/time_series/${timeSeriesId}/`)
    return response.data;
  } catch (error) {
    console.error(error);
  }
}
