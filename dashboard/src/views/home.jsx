import {useEffect, useState} from 'react';
import { FaTimes } from 'react-icons/fa';
import orcLogo from '/orc_favicon.svg'
import api from '../api/api.js';
import {useMessage} from '../messageContext';
import {Pie} from "react-chartjs-2";

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
          // water level config found
          setWaterLevel(true);
        } else {
          // water level config not found
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


  // charts
  const videoStatusChartData = {
    labels: ['New videos', 'Queued', 'Success', 'Error'],
    datasets: [
      {
        data: [200, 50, 700, 50],
        // data: [device.used_disk_space, device.disk_space - device.used_disk_space],
        backgroundColor: [
          'rgba(255,229,99,0.8)',
          'rgba(75,147,192,0.8)',
          'rgba(85,182,69,0.8)',
          'rgba(223,10,10,0.8)',
        ],
        // borderColor: [
        //   'rgb(255,99,99)',
        //   'rgba(75,147,192, 1)',
        // ],
        // borderWidth: 1,
      },
    ],
  };

  const videoSyncStatusChartData = {
    labels: ['Local', 'Synced', 'Updated', 'Error'],
    datasets: [
      {
        data: [200, 50, 700, 50],
        // data: [device.used_disk_space, device.disk_space - device.used_disk_space],
        backgroundColor: [
          'rgba(255,229,99,0.8)',
          'rgba(75,147,192,0.8)',
          'rgba(85,182,69,0.8)',
          'rgba(223,10,10,0.8)',
        ],
        // borderColor: [
        //   'rgb(255,99,99)',
        //   'rgba(75,147,192, 1)',
        // ],
        // borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
        align: 'start',
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            // const label = context.label || '';
            const value = context.raw || 0;
            return ` ${value} videos`;
          }
        }
      }
    },
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <a href="https://openrivercam.org" target="_blank">
          <img src={orcLogo} className="logo"/>
        </a>
      <h1> OpenRiverCam-OS</h1>
      </div>
      <div className="split-screen flex"  style={{overflowY: "auto"}}>
        <div className="flex-container column" style={{height: "calc(100vh - 350px"}}>
          <h4>Device status</h4>
          <div className="flex-container no-padding">
            <label>
              Device status:
            </label>
            <div className="readonly">{deviceStatus}</div>
          </div>
          <div className="flex-container no-padding">
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
          <div className="flex-container no-padding">
            <label>
              Device status:
            </label>
            <div className="readonly">{deviceStatus}</div>
          </div>
          <div className="flex-container no-padding">
            <label>
              Connectivity status:
            </label>
            <div className="readonly">N/A</div>
          </div>
          <div className="flex-container no-padding">
            <label>
              {"Disk space: "}
            </label>
            <div className="readonly"> Show amount of GB free</div>
          </div>
        </div>
        <div className="flex-container column" style={{height: "calc(100vh - 350px"}}>
          <h4>Processed videos</h4>
          <div className="flex-container no-padding">
            {/*<label>*/}
            {/*  Processed videos:*/}
            {/*</label>*/}
            <div className='mb-3 mt-3'>
              <div className='text-center mt-2'>
                <p>Process status</p>
              </div>
              <div style={{ width: '250px', margin: '0 auto' }}>
                <Pie data={videoStatusChartData} options={chartOptions} />
              </div>
            </div>

            <div className='mb-3 mt-3'>
              <div className='text-center mt-2'>
                <p>Sync status</p>
              </div>
              <div style={{ width: '250px', margin: '0 auto' }}>
                <Pie data={videoSyncStatusChartData} options={chartOptions} />
              </div>
            </div>

            {/*<div className="readonly">Here a pie-diagram with the processed videos and their cumulative status</div>*/}
          </div>
          <h4>Last video</h4>
          <div className="flex-container no-padding">
            {/*<label>*/}
            {/*  Last video:*/}
            {/*</label>*/}
            {/*<div className="readonly">Here a display of the last processed video with its time and status</div>*/}
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
