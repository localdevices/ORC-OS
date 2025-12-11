import api from "../../api/api.js";

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
  setMessageInfo("success", "Download started, please don't refresh or close the page until download is finished.");

}

export const listVideoCount = async (api, start, stop, status, sync_status, first, count,
) => {
  try {
    const response = await api.get("/video/count/", {params: {
        start: start,
        stop: stop,
        status: status,
        sync_status: sync_status,
        first: first,
        count: count,
      }});
    return response.data;
  } catch (error) {
    console.error(error);
  }
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

export const sync_videos = async (api, syncStartDate, syncEndDate, syncSettings, setMessageInfo) => {
  try {
    const response = await api.post(
      "/video/sync/", {
        start: syncStartDate,
        stop: syncEndDate,
        sync_file: syncSettings.syncFile,
        sync_image: syncSettings.syncImage
      }
    )
    if ( response.status === 200 ) {
      setMessageInfo("success", "Video sync job sent and received");
    } else {
      new Error("Error syncing videos");
    }
  } catch (error) {
    setMessageInfo("error", error);
  }
}


export const delete_videos = async (api, deleteStartDate, deleteEndDate, setMessageInfo) => {
  /* delete videos between start and end date. */
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

export const patchVideo = async (id, videoPatch) => {
  /* patch a video object with the given id and fields in videoPatch.*/
  try {
    const response = await api.patch(`/video/${id}/`, videoPatch)
    return response.data;
  } catch (error) {
    console.error(error)
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
    const response = await api.get(`/video/${video.id}/run/`);
    // update the status of the video
    video.status = response.data.status;
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

export const sync_video = async(video, setMessageInfo) => {
  try {
    // Ensure the video ID is available
    if (!video?.id) {
      setMessageInfo("error", "No video ID found to sync the video.");
      return;
    }

    // Make the API call
    const response = await api.post(`/video/${video.id}/sync/`);
    // update the status of the video
    video.sync_status = response.data.sync_status;
    // setVideo({ ...video, status: response.data.status});
    console.log("Sync video response:", response.data);

    // Display success message
    setMessageInfo("success", "Video has been submitted for syncing.");
  } catch (error) {
    console.error("Error syncing the video:", error);

    // Handle error and send message to container
    const errorMessage =
      error.response?.data?.detail || "An unexpected error occurred while syncing the video.";
    setMessageInfo("error", errorMessage);
  }
}
