import {useEffect, useState} from 'react';
import {FaCheck, FaQuestion, FaExclamation} from 'react-icons/fa';
import orcLogo from '/orc_favicon.svg'
import api from '../api/api.js';
import ServerStatus from './callbackUrlComponents/serverStatus.jsx'

import {useMessage} from '../messageContext';
import {listVideoCount} from "../utils/apiCalls/video.jsx";
import {VideoDetails} from "./videoComponents/videoDetails.jsx";
import {getCallbackUrl} from "../utils/apiCalls/callbackUrl.jsx";

import {Pie} from "react-chartjs-2";

const Home = () => {
  const [diskManagementStatus, setDiskManagementStatus] = useState(null);
  const [serverStatus, setServerStatus] = useState(null);
  const [videoCounts, setVideoCounts] = useState({});
  const [videoSyncCounts, setVideoSyncCounts] = useState({});
  const [daemonStatus, setDaemonStatus] = useState(null)
  const [videoConfig, setVideoConfig] = useState( null)
  const [waterLevel, setWaterLevel] = useState(false);
  const [lastVideo, setLastVideo] = useState(null);
  // set message box
  const {setMessageInfo} = useMessage();

  const fetchDiskManagement = async () => {
    try {
      const response = await api.get('/disk_management/')
      if ( response.status === 200 ) {
        setDiskManagementStatus(response.data)
      }
      else {
        throw new Error("Invalid API response: " + response.status)
      }
    } catch (error) {
      setMessageInfo("error retrieving device status", error);
    }
  }

  const fetchOnlineStatus = async () => {
    const callbackUrlData = await getCallbackUrl();
    if (callbackUrlData.url) {
      const response = await api.get('/callback_url/health/');
      if (response.data != null) {
        setServerStatus(response.data);
      }
    }
  }
  const fetchWaterLevel = async () => {
    await api.get('/water_level/')
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
  const fetchDaemon = async () => {
    try {
      const settingsResponse = await api.get('/settings/');
      setDaemonStatus(settingsResponse.data)

      if (settingsResponse.data) {
        const videoConfigResponse = await api.get(`/video_config/${settingsResponse.data.video_config_id}/`);
        setVideoConfig(videoConfigResponse.data);
      }
    } catch (error) {
          setMessageInfo("error retrieving daemon or video configuration", error);
    }
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
      SYNCED: syncCounts[1],
      UPDATED: syncCounts[2],
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
    fetchDiskManagement();
    fetchOnlineStatus();
    // fetchCameraConfigs();
    fetchWaterLevel();
    fetchVideoCounts();
    fetchLastVideo();
    fetchDaemon();
  }, [])


  // charts
  const videoStatusChartData = {
    labels: [
      `New videos (${videoCounts.NEW})`,
      `Queued (${videoCounts.QUEUED})`,
      `Success (${videoCounts.SUCCESS})`,
      `Error (${videoCounts.ERROR})`
    ],
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
      },
    ],
  };

  const videoSyncStatusChartData = {
    labels: [
      `Local (${videoSyncCounts.LOCAL})`,
      `Updated (${videoSyncCounts.UPDATED})`,
      `Synced (${videoSyncCounts.SYNCED})`,
      `Not synced (${videoSyncCounts.FAILED})`
    ],
    datasets: [
      {
        data: [videoSyncCounts.LOCAL, videoSyncCounts.UPDATED, videoSyncCounts.SYNCED, videoSyncCounts.FAILED],
        // data: [device.used_disk_space, device.disk_space - device.used_disk_space],
        backgroundColor: [
          'rgb(225,195,62)',
          'rgb(75,147,192)',
          'rgb(56,120,47)',
          'rgb(223,10,10)',
        ],
      },
    ],
  };
  const chartOptions = {
    responsive: true,
    devicePixelRatio: 1,
    // layout: {
    //   padding: { right: 8 },
    // },
    // maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        align: 'start',
        labels: {
          // pointStyle: 'rect',         // square
          boxWidth: 10,               // small square size
          boxHeight: 10,
          maxWidth: 100,
        }
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
          <img alt="logo" src={orcLogo} className="logo"/>
        </a>
        <h1> OpenRiverCam-OS</h1>
      </div>
      <div className="split-screen flex"  style={{overflowY: "hidden"}}>
        <div className="flex-container column no-padding">
          <div className="flex-container column" style={{height: "calc(100vh - 300px", minHeight: "723px"}}>

            <h4>{!lastVideo ? ("Last video") : (
              `Last video taken ${lastVideo.timestamp}`
            )
            }</h4>
            <div className="flex-container row no-padding" style={{height: "calc(100vh - 380px"}}>
              {lastVideo ? (
                <VideoDetails selectedVideo={lastVideo}/>
              ) : "No data"
              }
            </div>
          </div>
        </div>
        <div className="flex-container column no-padding" style={{height: "calc(100vh - 250px"}}>
          <div className="flex-container column">
            <h4>Processed videos</h4>
            <div className="flex-container no-padding">
              <div className='mb-3 mt-0'>
                <div className='text-left mt-0'>
                  <p>Process status</p>
                </div>
                <div>
                  <Pie width={250} height={250} data={videoStatusChartData} options={chartOptions} />
                </div>
              </div>
              <div className='mb-3 mt-0'>
                <div className='text-left mt-0'>
                  <p>Sync status</p>
                </div>
                <div>
                  <Pie width={250} height={250} data={videoSyncStatusChartData} options={chartOptions} />
                </div>
              </div>
            </div>
          </div>
          <div className="flex-container column" style={{height: "calc(100vh - 692px", minHeight: "330px"}}>
            <h4>Device status</h4>

            <div className="mb-0 mt-0">
              <label style={{minWidth: "120px", fontWeight: "bold"}}>
                Water level configuration:
              </label>
              <div
                className="readonly">{
                  waterLevel === false ? (
                    <div><FaQuestion style={{color: "orange"}}/> Not set</div>
                  ) : (
                    <div><FaCheck style={{color: "green"}}/> Set</div>
                  )
                }
              </div>
            </div>
            <div className="mb-0 mt-0">
              <label style={{minWidth: "120px", fontWeight: "bold"}}>
                Connectivity status:
              </label>
              {serverStatus ? (
              <ServerStatus serverStatus={serverStatus}/>
              ) : ("No server configured")}
            </div>
            <div className="mb-0 mt-0">
              <label style={{minWidth: "120px", fontWeight: "bold"}}>
                Disk management:
              </label>
              <div
                className="readonly">{
                !diskManagementStatus ? (
                  <div><FaQuestion style={{color: "orange"}}/> Not set - if you run out of disk space, your device may fail</div>
                ) : (
                  <div><FaCheck style={{color: "green"}}/> {`Disk cleanup at < ${diskManagementStatus.min_free_space} GB available`}</div>
                )
              }
              </div>
            </div>
            <div className="mb-0 mt-0">
              <label style={{minWidth: "120px", fontWeight: "bold"}}>
                Daemon settings:
              </label>
              <div
                className="readonly">{
                !daemonStatus ? (
                  <div><FaQuestion style={{color: "orange"}}/> No daemon settings available</div>
                ) : (
                  daemonStatus.video_config_id && videoConfig ? (
                    <div><FaCheck style={{color: "green"}}/> {`Daemon configured with video config "${videoConfig.id} - ${videoConfig.name}"`}</div>
                  ) : (
                    <div><FaExclamation style={{color: "orange"}}/> {`Daemon has no valid video config`}</div>
                  )
                )
              }
              </div>
              <div
                className="readonly">{
                !daemonStatus?.active ? (
                  <div><FaExclamation style={{color: "orange"}}/> Daemon is not active</div>
                ) : (
                  <div><FaCheck style={{color: "green"}}/> {`Daemon running`}</div>
                )
              }
                {daemonStatus?.active && daemonStatus?.sample_file ? (
                  <div>{`Waiting for files of type ${daemonStatus.sample_file}`}</div>
                ) : (<div></div>) }

              </div>
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
