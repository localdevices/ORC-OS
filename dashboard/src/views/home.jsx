import {useEffect, useState} from 'react';
import { FaTimes } from 'react-icons/fa';
import orcLogo from '/orc_favicon.svg'
import api from '../api/api.js';
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
        if (response.data !== null) {
          console.log("Water level configuration found");
          setWaterLevel(true);
        } else {
          console.log("Water level configuration not found");
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
            <span>Welcome to ORC-OS configuration!</span>
          </span>
          <FaTimes
            onClick={() => setShowMessage(false)} // Hide the message on clicking
          />

        </div>
      )}
      <div>
        <a href="https://openrivercam.org" target="_blank">
          <img src={orcLogo} className="logo" alt="ORC logo" />
        </a>
      </div>
      <h1>OpenRiverCam-OS configuration</h1>
      <div className="flex-container">
        <div className="card">
          <h4>Device status</h4>
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
            <div className="readonly">{
              waterLevel === false ?
                "No water level settings found, only manual water level or optical detection possible" :
                "Water level retrieval configured for automated processing"
            }
            </div>
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
