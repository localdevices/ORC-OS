import api from "../../api/api.js";


export const startUpdate = async (tagName) => {
  // start the update process
  const url = `/updates/start/${tagName}/`;
  console.log("Starting update with URL: ", url);
  const response = await api.post(url);
  return response.data;
}
