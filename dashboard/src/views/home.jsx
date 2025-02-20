import {useEffect, useState} from 'react';
import { FaTimes } from 'react-icons/fa';
import orcLogo from '/orc_favicon.svg'
import api from '../api';
import MessageBox from "../messageBox.jsx";
import {useMessage} from '../messageContext';

const Home = () => {
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [cameraConfigs, setCameraConfigs] = useState([]);
  const [waterLevel, setWaterLevel] = useState(false);
  const [showMessage, setShowMessage] = useState(true);
  // set message box
  const {setMessageInfo} = useMessage();

  const fetchDevice = async () => {
    try {
      const response = await api.get('/device/')
      if ( response.status === 200 ) {
        setDeviceStatus(response.data.status)
      }
      else {
      throw new Error("Invalid API response: " + response.status)
      }
    } catch (error) {
      setMessageInfo("error retrieving device status", error);
    }
  }

  const fetchCameraConfigs = async () => {
    try {
      const response = await api.get('/camera_config/')
      if ( response.status === 200 ) {
        setCameraConfigs(response.data)
      }
      else {
        throw new Error("Invalid API response: " + response.status)
      }
    } catch (error) {
      setMessageInfo("error retrieving device status", error);
    }
  }
  const fetchWaterLevel = async () => {
    const response = await api.get('/water_level/')
      .then((response) => {
        console.log(response);
        if (response.data !== null) {
          console.log("Water level found");
          setWaterLevel(true);
        } else {
          console.log("Water level not found");
          setWaterLevel(false);
        }
      }
    )
  }
  useEffect(() => {
    fetchDevice();
    fetchCameraConfigs();
    fetchWaterLevel();
  }, [])

  return (
    <>
    {showMessage && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0e6bb1',
          color: '#fff',
          padding: '10px',
          borderBottom: '1px solid #ccc'
        }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <strong style={{ marginRight: '8px', fontSize: '18px' }}>!</strong>
            <span>Welcome to NodeORC configuration!</span>
          </span>
          <FaTimes
            onClick={() => setShowMessage(false)} // Hide the message on clicking
          />

        </div>
      )}
      <div>
        <a href="https://openrivercam.org" target="_blank">
          <img src={orcLogo} className="logo" alt="Vite logo" />
        </a>
      </div>
      <h1>NodeORC configuration</h1>
      <div className="flex-container">
        <div className="card">
          <h4>Device status</h4>
          Here you will see the status and connectivity of the device.
          <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
            <label>
              Device status:
            </label>
            <div className="readonly">{deviceStatus}</div>
          </div>
          <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
            <label>
              Water level configuration:
            </label>
            <div className="readonly">{waterLevel === false ? "No water level settings found, only optical detection possible" : "Water level retrieval configured"}</div>
          </div>
          <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
            <label>
              Camera configurations:
            </label>
            <div className="readonly">{cameraConfigs.length > 0 ? cameraConfigs.length : "None found, first create a camera configuration"}</div>
          </div>
          <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
            <label>
              Device status:
            </label>
            <div className="readonly">{deviceStatus}</div>
          </div>
          <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
            <label>
              Connectivity status:
            </label>
            <div className="readonly">N/A</div>
          </div>
          <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
            <label>
              Disk space:
            </label>
            <div className="readonly">Show amount of GB free</div>
          </div>


        </div>
        <div className="card">
          <h4>Video status</h4>
          Here you will see the status of all videos.
          <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
            <label>
              Processed videos:
            </label>
            <div className="readonly">Here a pie-diagram with the processed videos and their cumulative status</div>
          </div>
          <div className="flex-container" style={{display: "flex", flexDirection: "row"}}>
            <label>
              Last video:
            </label>
            <div className="readonly">Here a display of the last processed video with its time and status</div>
          </div>
        </div>
      </div>

      <p className="read-the-docs">
        Click on the OpenRiverCam logo to read about the underlying methods.
      </p>
    </>
  )
}


export default Home;