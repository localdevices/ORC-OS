import api from "../../api/api.js";

export const orcVersion = async () => {
  try {
    const response = await api.get("/updates/check");
    // console.log(response.data);
    return response.data;
  } catch (error) {
    console.log(error);
  }
}

export const startUpdate = async () => {
  // start the update process
  const response = await api.post("/updates/start");
  return response.data;
}
