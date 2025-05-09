// import api from "../api.js";

export const fitGcps = async (api, widgets, imgDims, epsgCode, setWidgets, setMessageInfo) => {

  // // temporary test function;
  // const updateWidgets = () => {
  //   setWidgets((prevWidgets) =>
  //     prevWidgets.map((widget) => ({
  //       ...widget,
  //       fit: {"row": 1075, "col": 1915},
  //     }))
  //   );
  // };
  try {
    // Checks!
    if (widgets.length < 0) {
      const msg = `Too few GCPs (${widgets.length} / 6)`
      setMessageInfo('error', msg);
//      throw new Error(msg);
    }

    // Extract coordinates into separated lists
    const dst = widgets.map(({ coordinates }) => [
      parseFloat(coordinates.x) || null,
      parseFloat(coordinates.y) || null,
      parseFloat(coordinates.z) || null
    ]);

    const src = widgets.map(({ coordinates }) => [
      parseFloat(coordinates.col, 10) || null,
      parseFloat(coordinates.row, 10) || null,
    ]);
    // check if dst contains null
    if (dst.some(row => row.includes(null))) {
      setMessageInfo('error', 'GCP real-world coordinates are not complete. Ensure the coordinates are entered correctly and try again.');
    }

    // check if src contains null values
    if (src.some(row => row.includes(null))) {
      setMessageInfo('error', 'GCPs must have valid row and column coordinates. Please click the GCPs into the image frame to fix this.');
      return;
    }
    const payload = {
      "src": src,
      "dst": dst,
      "height": imgDims.height,
      "width": imgDims.width,
      "crs": epsgCode.toString()
    };
    const response = await api.post('/camera_config/fit_perspective', payload);
    // Extract `src_est` and `dst_est` from API response
    const { src_est, dst_est, error } = response.data;
    // Map the fitted coordinates back to the widgets
    setWidgets((prevWidgets) =>
      prevWidgets.map((widget, index) => {
        return {
          ...widget,
          fit: {
            row: src_est ? src_est[index][1] : null, // row from src_est
            col: src_est ? src_est[index][0] : null, // col from src_est
            x: dst_est ? dst_est[index][0] : null,  // x from dst_est
            y: dst_est ? dst_est[index][1] : null,  // y from dst_est
            z: dst_est ? dst_est[index][2] : null,  // z from dst_est
          }
        };
      })
    );
    const err_round = Math.round(error * 1000) / 1000;
    if (err_round > 0.1) {
      setMessageInfo('warning', `GCPs successfully fitted, but with a large average error: ${err_round} m.`);
      return;}
    setMessageInfo('success', `GCPs successfully fitted to image, average error: ${err_round} m.`);
    // map the estimated points on the widgets for plotting
    // updateWidgets();

  } catch (error) {
    setMessageInfo('error', 'Failed to send coordinates:' + error.response.data.detail);
    // Optionally, handle errors (e.g., display an error message)
  }
};

export const get_videos_ids = async (api, selectedIds, setMessageInfo) => {
  try {
    const response = await api.post(
      `/video/download_ids/`,
      selectedIds,
      {
        responseType: "blob",
      }
    ) // Retrieve zip-file for selection

    // Create a link element to trigger the file download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;

    // Set the download filename from the Content-Disposition (if provided) or use a fallback
    const contentDisposition = response.headers['content-disposition'];
    console.log(response.headers);
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1].split(';')[0].replace(/"/g, '') // Extract filename
      : 'download.zip'; // Fallback filename if header doesn't exist.
    console.log(filename);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode.removeChild(link); // Clean up the temporary DOM element
  } catch (error) {
    setMessageInfo("error: ", error);
  }
  setMessageInfo("success", "Download started, please don´t refresh or close the page until download is finished.");

}

export const get_videos = async (api, downloadStartDate, downloadEndDate, downloadSettings, setMessageInfo) => {
  try {
    const response = await api.post(
      "/video/download/", {
        get_image: downloadSettings.downloadImage,       // Set to true if you want the image files
        get_video: downloadSettings.downloadVideo,       // Set to true if you want video files
        get_netcdfs: downloadSettings.downloadNetcdf,    // Set to true if you want netCDF files
        get_log: downloadSettings.downloadLog,
        start: downloadStartDate,
        stop: downloadEndDate,
      },
      {
        responseType: "blob"
      }
    ) // Retrieve zip-file for selection
    if ( response.status === 200 ) {
      // Create a link element to trigger the file download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      // Set the download filename from the Content-Disposition (if provided) or use a fallback
      const contentDisposition = response.headers['content-disposition'];
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1].split(';')[0].replace(/"/g, '') // Extract filename
        : 'download.zip'; // Fallback filename if header doesn't exist.
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link); // Clean up the temporary DOM element
      setMessageInfo("success", "Download started, please don´t refresh or close the page until download is finished.");
    } else {
      throw new Error(`Invalid form data. Status Code: ${response.status}`);
    }
  } catch (error) {
    if (error.response) {
      setMessageInfo("error", "Error: No videos found for the selected time period.");
    } else if (error.request) {
      // No response received
      setMessageInfo("error", "Error: No response from the server. Please check your connection.");
    } else {
      // Some other error occurred
      setMessageInfo("error", `Error: ${error.message}`);

    }
  }
}

export const delete_videos = async (api, deleteStartDate, deleteEndDate, setMessageInfo) => {
  try {
    const response = await api.post(
      "/video/delete/", {
        start: deleteStartDate,
        stop: deleteEndDate,
      }
    )
    if ( response.status === 204 ) {
      setMessageInfo("success", "Videos deleted.");
    } else {
      new Error("Error deleting videos");
    }
  } catch (error) {
    setMessageInfo("error", error);
  } finally {
    // ensure deletes are administered to the application
    window.location.reload()
  }
}
