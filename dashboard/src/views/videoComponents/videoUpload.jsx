import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import Modal from "react-modal"; // You can use any modal library or create your custom modal
import "../../App.css"
import api from "../../api/api.js";
import PropTypes from "prop-types";

const VideoUploader = ({uploadedVideo, setUploadedVideo}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDateTime, setSelectedDateTime] = useState(""); // State for date and time

  useEffect(() => {
    const preventDefault = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    // Prevent unintentional drag-and-drop on the window
    window.addEventListener("dragenter", preventDefault);
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);

    return () => {
      window.removeEventListener("dragenter", preventDefault);
      window.removeEventListener("dragover", preventDefault);
      window.removeEventListener("drop", preventDefault);
    };
  }, []);


  const onDrop = useCallback((acceptedFiles) => {
    if (acceptedFiles && acceptedFiles[0]) {
      const file = acceptedFiles[0];
      if (!file.type.startsWith("video/")) {
        alert("Please upload a valid video file.");
        return;
      }

      setUploadedVideo(file);
      setIsModalOpen(true); // Open modal for next steps
    }
  }, []);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles) => {
      console.log("onDrop trggered with: " , acceptedFiles)
      onDrop(acceptedFiles);
    },
    onDropRejected: (rejectedFiles) => {
      console.log("onDropRejected trggered with: " , rejectedFiles)

    },

    accept: "video/*",
    multiple: false,
  });

  const handleDateChange = (e) => {
    setSelectedDateTime(e.target.value);
  };

  // Handle form submission to the API
  const handleSubmit = async () => {
    // Validate input: Ensure both file and timestamp are provided
    if (!selectedDateTime || !uploadedVideo) {
      alert("Please provide both a video file and a timestamp.");
      return;
    }

    // Prepare form data for submission
    const formData = new FormData();
    formData.append("file", uploadedVideo); // Append video file
    formData.append("timestamp", selectedDateTime); // Append timestamp

    try {
      // Submit the POST request to the /video API
      const response = await api.post("/video/", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Handle response (success case)
      console.log("File uploaded successfully:", response.data);
      alert("Video uploaded successfully!");

      // Reset inputs and close modal
      setUploadedVideo(null);
      setSelectedDateTime("");
      setIsModalOpen(false);
    } catch (error) {
      // Handle errors (failure case)
      console.error("Error uploading video:", error);
      alert("Failed to upload video.");
    }
  };


  return (
    <div className="video-uploader">
      <h5>Upload a Video</h5>
      <div
        {...getRootProps()}
        style={{
          border: "2px dashed #ccc",
          padding: "20px",
          cursor: "pointer",
          textAlign: "center",
          marginBottom: "20px",
          marginTop: "20px",
        }}
      >
        <input {...getInputProps()} />
        <p>Drag & drop a video here, or click to select one.</p>
      </div>

      {uploadedVideo && (

        <Modal
          isOpen={isModalOpen}
          onRequestClose={() => setIsModalOpen(false)}
          contentLabel="Video Upload Options"
          style={{
            overlay: {
              backgroundColor: "rgba(0, 0, 0, 0.6)",
            },
            content: {
              maxWidth: "600px", // Limit width for modal content
              maxHeight: "300px", // Limit height for modal content
              overflow: "auto", // Allow scrollbars if content overflows
              margin: "auto", // Center modal horizontally and vertically
              borderRadius: "8px",
              padding: "20px",
            },
          }}

        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Video Options</h2>
            <button
              style={{
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
                lineHeight: "1",
              }}
              onClick={() => setIsModalOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
          <p>You have uploaded: {uploadedVideo.name}</p>
          {/* Date-Time Picker */}
          <div style={{ marginBottom: "15px" }}>
            <label htmlFor="video-datetime" style={{ display: "block", marginBottom: "5px", fontWeight: "bold" }}>
              Select Date and Time:
            </label>
            <input
              type="datetime-local"
              id="video-datetime"
              value={selectedDateTime}
              onChange={handleDateChange}
              style={{
                width: "100%",
                padding: "10px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
              required
            />
          </div>

          <div>
            <button className="btn" onClick={handleSubmit}>
              Upload
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

VideoUploader.propTypes = {
  uploadedVideo: PropTypes.string,
  setUploadedVideo: PropTypes.func.isRequired,
};
export default VideoUploader;
