import {useState, useEffect} from 'react';
import api from "../api/api.js"
import './cameraAim.scss'

import {FaRaspberryPi} from "react-icons/fa6";
import { PiRecordFill } from "react-icons/pi"
import {DropdownMenu} from "../utils/dropdownMenu.jsx";
import ReactSlider from "react-slider";
import {useMessage} from "../messageContext.jsx";

const CameraAim = () => {
  const [videoFeedUrl, setVideoFeedUrl] = useState("");
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isToggledOn, setIsToggledOn] = useState(false); // Toggle state
  const [hasPiCamera, setHasPiCamera] = useState(true); // State
  const [cameraModels, setCameraModels] = useState([]); // list of camera models
  const [piFormData, setPiFormData] = useState({
    camera_idx: 0,
    resolution: [1920, 1080],  // default resolution
    fps: 30,  // default fps
    length: 5,

  });

  const resolutionValues = [
    {id: 1, name: "4K ", value: [3840, 2160]},
    {id: 2, name: "QHD ", value: [2560, 1440]},
    {id: 3, name: "HD ", value: [1920, 1080]},
    {id: 4, name: "FHD ", value: [1280, 720]},
    {id: 5, name: "SVGA ", value: [800, 600]},
    {id: 6, name: "VGA ", value: [640, 480]},
  ]
  const {setMessageInfo} = useMessage();

  // define if the switch for Raspi camera should be disabled or enabled
  useEffect(() => {
    const fetchSwitchState = async () => {
      try {
        const response = await api.get("/pivideo_stream/has_picam/");
        if (response.status === 200) {
          setHasPiCamera(response.data); // Disable if "enabled" is false
          if (!response.data) {
            setVideoFeedUrl("");
            setIsToggledOn(false);
          } else {
            // also request the camera models and set those
            const responseCameraModels = await api.get("/pivideo_stream/picam_info/");
            if (responseCameraModels.data === null) {
              // empty list
              setCameraModels([]);
            } else {
              setCameraModels(
                  responseCameraModels.data.map((item, idx) => ({id: idx, name: item.Model}))
                );
            }

          }
        } else {
          throw new Error("Invalid API response");
        }
      } catch (error) {
        console.error("Failed to fetch availability of Raspi camera:", error);
        setError("Failed to establish if a raspberry pi camera is available or not.");
      }
    };

    fetchSwitchState(); // Call the function when the component mounts
  }, []);

  // Function to handle the toggle state change
  const handleTogglePreview = async () => {
    setIsLoading(true);
    const newState = !isToggledOn; // Determine new state
    try {
      if (newState) {
        // Call endpoint for "enabled" state
        let endPoint = `/pivideo_stream/start/`
        if (piFormData.camera_idx !== null) {
          endPoint += `?camera_idx=${piFormData.camera_idx}`;
        }
        if (piFormData.resolution[0] && piFormData.resolution[1]) {
          endPoint += `&width=${piFormData.resolution[0]}&height=${piFormData.resolution[1]}`
        }
        if (piFormData.fps) {
          endPoint += `&fps=${piFormData.fps}`
        }

        await api.post(endPoint);
        // re-create a unique url to prevent the browser thinks it can use a cached version
        const feedUrl = `${api.defaults.baseURL}/pivideo_stream/stream/?${new Date().getTime()}`;
        console.log(`setting feed to ${feedUrl}`);
        setVideoFeedUrl(feedUrl);
        setIsToggledOn(true);
      } else {
        // Call endpoint for "disabled" state
        await api.post('/pivideo_stream/stop/');
        setVideoFeedUrl("");
        setIsToggledOn(false);
      }
    } catch (error) {
      console.error("Error or disabling PiCamera:", error);
      setIsToggledOn(false);
      setError('Failed to enable/disable PiCamera. Try to refresh this page to try again.');
    } finally {
      console.log("Setting load status to false")
      setIsLoading(false);
    }
  };
  const handleVideoRecord = async () => {
    try {
      let endPoint = `/pivideo_stream/record/`
      if (piFormData.camera_idx !== null) {
        endPoint += `?camera_idx=${piFormData.camera_idx}`;
      }
      if (piFormData.resolution[0] && piFormData.resolution[1]) {
        endPoint += `&width=${piFormData.resolution[0]}&height=${piFormData.resolution[1]}`
      }
      if (piFormData.fps) {
        endPoint += `&fps=${piFormData.fps}`
      }
      const response = await api.post(endPoint);
      // const response = await api.post("/pivideo_stream/record");

      if (response.status === 200 && response.data?.message) {
        setMessageInfo('success', response.data.message);
      } else {
        throw new Error(
          `Unexpected response: ${response.status}, ${response.data}`
        );
      }
    } catch (error) {
      console.error("Error while calling the record endpoint:", error);
      setMessageInfo("error", "Failed to start recording. Please try again later.");
    }
  }

  const handlePiDropdown = (event) => {
    const {value} = event.target;
    const value_ints = value.split(",");
    setPiFormData({
      ...piFormData,
      resolution: [parseInt(value_ints[0]), parseInt(value_ints[1])],
    });
  }

  const handleCameraDropdown = (event) => {
    const {value} = event.target;
    setPiFormData({
      ...piFormData,
      camera_idx: parseInt(value),
    });
  }

  // submit form to display stream
  const handleFormSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null); // reset errors before doing a new check
    const getVideoFeed = async () => {
      try {

        const videoUrl = event.target.videoUrl.value;
        if (videoUrl === "") {
          setVideoFeedUrl(null);
          setIsLoading(false);
        } else {
          const feedUrl = `${api.defaults.baseURL}/video_stream/feed/?video_url=${encodeURIComponent(videoUrl)}`;
          // test the feed by doing an API call
          console.log(`setting feed to ${feedUrl}`);
          const response = await api.head('/video_stream/feed/?video_url=' + encodeURIComponent(videoUrl));
          if (response.status === 200) {
            setVideoFeedUrl(feedUrl); // Set the dynamically generated URL
            console.log("Setting load status to false");
            setIsLoading(false);

          } else {
            throw new Error(`Invalid video feed. Status Code: ${response.status}`);
          }
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

  return (
    <>
      <div className='container'>
        <h2>Aim your camera</h2>

        <div className='flex-container no-padding'>
          <div className="flex-container column" style={{width: "70%", minWidth: "70%"}}>
            <h5>Live View</h5>
            {isLoading && <p>Loading video feed...</p>}
            {error ? (
              <p className="text-danger"><i>{error}</i></p>
            ) : (
              videoFeedUrl ? (
                <img
                  src={videoFeedUrl} // Dynamically set the URL
                  alt="Live Video Stream"
                  style={{maxWidth: "100%", height: "auto"}}
                />
              ) : (<p>Provide a video feed to see a Live View here</p>)
            )}
          </div>
          <div className='flex-container column'>
            <h5>RTSP video stream</h5>
            <div className='flex-container column'>
              <form onSubmit={handleFormSubmit}>
                <div className='mb-3 mt-3'>
                  <label htmlFor='name' className='form-label'>
                    Video stream URL (e.g. rtsp://... or http://)
                  </label>
                  <input type='text' className='form-control' id='videoUrl' name='videoUrl'/>
                  <div className="help-block">
                    Load your IP-camera stream on a rtsp location and port
                  </div>

                </div>
                <button type='submit' className='btn btn-primary'>
                  Submit
                </button>
              </form>
            </div>
            {hasPiCamera && (
              <>
                <h5>
                  <a href="https://www.raspberrypi.com" target="_blank"
                     style={{
                       display: 'flex',
                       alignItems: 'center',
                       gap: '8px',
                       color: 'inherit',
                       textDecoration: 'none'
                     }}>
                    You're on a
                    Raspberry Pi with PiCamera module
                    <FaRaspberryPi size={20} color="#C51A4A"/>
                  </a>
                </h5>
                <div className='flex-container column'>
                  {cameraModels.length > 0 ? (
                  <div className='mb-3 mt-3'>
                    <DropdownMenu
                      dropdownLabel={"Connected camera models"}
                      callbackFunc={handleCameraDropdown}
                      data={cameraModels}
                      value={piFormData.camera_idx}
                      disabled={cameraModels.length < 2}  // if only one model or zero is available, no reason to select
                      allowNoSelection={false}
                    />
                    <div className="help-block">
                      Select the Raspberry Pi camera model you want to use
                    </div>
                  </div>
                  ) : (<p className="text-danger"><i>
                    No cameras found. Please check the ribbon cable connections if a camera is expected.
                  </i></p>)}
                  <div className='mb-3 mt-3'>
                    <DropdownMenu
                      dropdownLabel={"Resolution"}
                      callbackFunc={handlePiDropdown}
                      data={resolutionValues}
                      value={piFormData.resolution}
                      defaultValue={[1920, 1080]}
                      disabled={cameraModels.length < 1}
                      allowNoSelection={false}
                    />
                    <div className="help-block">
                      Select the resolution with which you want to stream or record
                    </div>
                  </div>
                  <div className="mb-3 mt-3 form-horizontal">
                    <label htmlFor="fps" className="form-label">
                      Frames per second
                    </label>
                    <ReactSlider
                      className="horizontal-slider"
                      thumbClassName={cameraModels.length < 1 ? "thumb thumb-disabled" : "thumb"}
                      value={piFormData.fps || 30} // Default values if unset
                      min={5}
                      max={60}
                      step={1}
                      renderThumb={(props, state) => (
                        <div {...props}>
                          <div className="thumb-value">{state.valueNow}</div>
                        </div>
                      )}
                      onChange={(value) => {
                        setPiFormData({...piFormData, fps: value})
                      }}
                      disabled={cameraModels.length < 1}
                    />
                  </div>
                  <div className="mb-3 mt-3 form-horizontal">
                    <label htmlFor="videoLength" className="form-label">
                      Sample Video length
                    </label>
                    <ReactSlider
                      className="horizontal-slider"
                      thumbClassName={cameraModels.length < 1 ? "thumb thumb-disabled" : "thumb"}
                      trackClassName="track"
                      value={piFormData.length || 5} // Default values if unset
                      min={1}
                      max={10}
                      step={1}
                      renderThumb={(props, state) => (
                        <div {...props}>
                          <div className="thumb-value">{state.valueNow}</div>
                        </div>
                      )}
                      onChange={(value) => {
                        setPiFormData({...piFormData, length: value})
                      }}
                      disabled={cameraModels.length < 1}
                    />
                  </div>
                  <div className='mb-3 mt-3'>
                    <div className="form-check form-switch">
                      <label className="form-label" htmlFor="picamSwitch">Start PiCamera Live View</label>
                      <input
                        style={{width: "40px", height: "20px", marginRight: "10px", borderRadius: "15px"}}
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        id="picamSwitch"
                        onClick={handleTogglePreview}
                        disabled={cameraModels.length < 1}
                      />
                    </div>

                    </div>
                  <div className="mb-3 mt-3">
                      <PiRecordFill
                        size={20}
                        color={cameraModels < 1 ? "#bbb" : "#C51A4A"}
                        style={{cursor: "pointer", marginRight: "10px"}}
                          onClick={handleVideoRecord}
                      />
                    <label className="form-label" htmlFor="picamRecord">Record sample video of {piFormData.length} sec.</label>
                    <div className="help-block">
                      The video will be available in your video list to use to setup a video configuration
                    </div>
                  </div>
                  </div>
              </>
            )}
          </div>
        </div>
      </div>
      {/*</div>*/}
    </>
  )
}


export default CameraAim;
