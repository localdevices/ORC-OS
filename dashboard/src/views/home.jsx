import {useEffect, useState} from 'react';
import { FaTimes } from 'react-icons/fa';
import orcLogo from '/orc_favicon.svg'
import api from '../api/api.js';
import {useMessage} from '../messageContext';
import {listVideoCount} from "../utils/apiCalls.jsx";
import {VideoDetails} from "./videoComponents/videoDetails.jsx";

import {Pie} from "react-chartjs-2";

const Home = () => {
  const [deviceStatus, setDeviceStatus] = useState(null);
  const [videoCounts, setVideoCounts] = useState({});
  const [videoSyncCounts, setVideoSyncCounts] = useState({});
  const [cameraConfigs, setCameraConfigs] = useState([]);
  const [waterLevel, setWaterLevel] = useState(false);
  const [showMessage, setShowMessage] = useState(true);
  const [lastVideo, setLastVideo] = useState(null);
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
  const fetchVideoCounts = async () => {
    // retrieve video counts by status
    const counts = [];
    for (let i = 1; i <= 5; i++) {
      counts.push(await listVideoCount(api, null, null, i));
    }
    setVideoCounts({
      NEW: counts[0],
      QUEUED: counts[1] + counts[2],
      SUCCESS: counts[3],
      ERROR: counts[4],
    });
    // same but according to sync status
    const syncCounts = [];
    for (let i = 1; i <= 4; i++) {
      syncCounts.push(await listVideoCount(api, null, null, null, i));
    }
    setVideoSyncCounts({
      LOCAL: syncCounts[0],
      SYNCED: syncCounts[2],
      UPDATED: syncCounts[1],
      FAILED: syncCounts[3],
    });
  }
  const fetchLastVideo = async() => {
    // get the last video in record
    const response = await api.get('/video/?count=1');
    // const response = await api.get('/video/8/');
    if (response.status === 200) {
      setLastVideo(response.data[0]);
    }
  }
  useEffect(() => {
    fetchDevice();
    fetchCameraConfigs();
    fetchWaterLevel();
    fetchVideoCounts();
    fetchLastVideo();
  }, [])


  // charts
  const videoStatusChartData = {
    labels: ['New videos', 'Queued', 'Success', 'Error'],
    datasets: [
      {
        data: [videoCounts.NEW, videoCounts.QUEUED, videoCounts.SUCCESS, videoCounts.ERROR],
        // data: [device.used_disk_space, device.disk_space - device.used_disk_space],
        backgroundColor: [
          'rgb(225,195,62)',
          'rgb(75,147,192)',
          'rgb(56,120,47)',
          'rgb(223,10,10)',
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
    labels: ['Local', 'Updated', 'Synced', 'Not synced'],
    datasets: [
      {
        data: [videoSyncCounts.LOCAL, videoSyncCounts.SYNCED, videoSyncCounts.UPDATED, videoSyncCounts.FAILED],
        // data: [device.used_disk_space, device.disk_space - device.used_disk_space],
        backgroundColor: [
          'rgb(225,195,62)',
          'rgb(75,147,192)',
          'rgb(56,120,47)',
          'rgb(223,10,10)',
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
      <div className="split-screen flex"  style={{overflowY: "hidden"}}>
        <div className="flex-container column no-padding">
        <div className="flex-container column" style={{height: "calc(100vh - 300px"}}>
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
        </div>
        <div className="flex-container column no-padding" style={{height: "calc(100vh - 250px"}}>
        <div className="flex-container column" style={{height: "400px"}}>
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
          </div>
        </div>
            {/*<div className="readonly">Here a pie-diagram with the processed videos and their cumulative status</div>*/}
          {/*</div>*/}
          <div className="flex-container column" style={{height: "calc(100vh - 720px"}}>

          <h4>Last video</h4>
          <div className="flex-container row no-padding" style={{height: "calc(100vh - 800px"}}>
            {lastVideo ? (
              <VideoDetails selectedVideo={lastVideo}/>
              ) : "No data"
            }
            {/*<label>*/}
            {/*  Last video:*/}
            {/*</label>*/}
            {/*<div className="readonly">Here a display of the last processed video with its time and status</div>*/}
          </div>
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
