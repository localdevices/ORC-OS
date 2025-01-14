import React, {useState, useEffect} from 'react';

import reactLogo from '/react.svg'
import orcLogo from '/orc_favicon.svg'
import api from "../api"

const CameraAim = () => {
  const [count, setCount] = useState(0)
  const [videoFeedUrl, setVideoFeedUrl] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // submit form to display stream
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null); // reset errors before doing a new check
    const getVideoFeed = async () => {
      try {
        console.log(event);
        const videoUrl = event.target.videoUrl.value;
//         const videoUrl = "rtsp://nodeorcpi:8554/cam";
        const feedUrl = `${api.defaults.baseURL}/video-feed/?video_url=${encodeURIComponent(videoUrl)}`; // Dynamically get it from Axios
        // test the feed by doing an API call
        const response = await api.head('/video-feed/?video_url=' + encodeURIComponent(videoUrl));
        if (response.status === 200) {
            setVideoFeedUrl(feedUrl); // Set the dynamically generated URL
            console.log("Setting load status to false");
            setIsLoading(false);

        } else {
            console.log("We have an error")
            throw new Error(`Invalid video feed. Status Code: ${response.status}`);
        }
      } catch (error) {
          setError('Failed to load video feed. Ensure the camera is connected and available.');
          console.error("Error generating video feed URL:", error);
      } finally {
          console.log("Setting load status to false")
          setIsLoading(false);
      }

    };

    getVideoFeed();
  };

  // Dynamically generate the stream URL
//   useEffect(() => {
//     setIsLoading(true);
//     setError(null); // reset errors before doing a new check
//     const getVideoFeed = async () => {
//       try {
//         const feedUrl = `${api.defaults.baseURL}/video-feed/`; // Dynamically get it from Axios
//         // test the feed by doing an API call
//         const response = await api.head('/video-feed/');
//         console.log(response);
//         if (response.status === 200) {
//             setVideoFeedUrl(feedUrl); // Set the dynamically generated URL
//             console.log("Setting load status to false");
//             setIsLoading(false);
//
//         } else {
//             console.log("We have an error")
//             throw new Error(`Invalid video feed. Status Code: ${response.status}`);
//         }
//       } catch (error) {
//           setError('Failed to load video feed. Ensure the camera is connected and available.');
//           console.error("Error generating video feed URL:", error);
//       } finally {
//           console.log("Setting load status to false")
//           setIsLoading(false);
//       }
//
//     };
//
//     getVideoFeed();
//   }, []); // Empty dependency to run this once after the component is mounted

  return (
    <>
      <h1>NodeORC configuration</h1>
      {isLoading && <p>Loading video feed...</p>}
      {error ? (
        <p className="text-danger">{error}</p>
      ) : (
        videoFeedUrl && (
          <img
          src={videoFeedUrl} // Dynamically set the URL
          alt="Live Video Stream"
          style={{ maxWidth: "100%", height: "auto" }}
          />
        )
      )}
      <div className='container'>
        <form onSubmit={handleFormSubmit}>
            <div className='mb-3 mt-3'>
                <label htmlFor='name' className='form-label'>
                    Video stream URL (e.g. rtsp://... or http://)
                </label>
                <input type='text' className='form-control' id='videoUrl' name='videoUrl'/>
            </div>
            <button type='submit' className='btn btn-primary'>
                Submit
            </button>
        </form>
      </div>
    </>
  )
}


export default CameraAim;