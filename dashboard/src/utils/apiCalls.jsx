import api from "../api/api.js";

export const fitGcps = async (imgDims, gcps, setMessageInfo) => {
  console.log(gcps);
  try {
    const response = await api.post('/control_points/fit_perspective', {
      "gcps": gcps,
      "height": imgDims.height,
      "width": imgDims.width,
    });
    // Extract `src_est` and `dst_est` from API response
    console.log(response.data);
    const { error } = response.data;

    const err_round = Math.round(error * 1000) / 1000;
    if (err_round > 0.1) {
      setMessageInfo('warning', `GCPs successfully fitted, but with a large average error: ${err_round} m.`);
    }
    setMessageInfo('success', `GCPs successfully fitted to image, average error: ${err_round} m.`);
    // map the estimated points on the widgets for plotting
    // updateWidgets();
    return response.data;
  } catch (error) {
    setMessageInfo('error', 'Failed to send coordinates:' + error.response.data.detail);
    // Optionally, handle errors (e.g., display an error message)
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
    const filename = contentDisposition
      ? contentDisposition.split('filename=')[1].split(';')[0].replace(/"/g, '') // Extract filename
      : 'download.zip'; // Fallback filename if header doesn't exist.
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

export const run_video = async(video, setMessageInfo) => {
  try {
    // Ensure the video ID is available
    if (!video?.id) {
      setMessageInfo("error", "No video ID found to run the video.");
      return;
    }

    // Make the API call
    const response = await api.get(`/video/${video.id}/run`);
    // update the status of the video
    video.status = response.data.status;
    // setVideo({ ...video, status: response.data.status});
    console.log("Run video response:", response.data);

    // Display success message
    setMessageInfo("success", "Video has been submitted for processing.");
  } catch (error) {
    console.error("Error running the video:", error);

    // Handle error and send message to container
    const errorMessage =
      error.response?.data?.detail || "An unexpected error occurred while running the video.";
    setMessageInfo("error", errorMessage);
  }



}
