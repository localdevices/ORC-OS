import {useState, useEffect, useRef} from 'react';
import ReactMarkdown from 'react-markdown';

import api, {createWebSocketConnection} from '../api/api.js';
import {orcVersion, startUpdate} from '../utils/apiCalls.jsx';
import "./updates.css"
import '../App.css';

const Updates = () => {
  const [currentVersion, setCurrentVersion] = useState(null);
  const [newVersion, setNewVersion] = useState(null);
  const [updateAvailable, setUpdateAvailable] = useState(null);
  const [releaseNotes, setReleaseNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [updateStatusMessages, setUpdateStatusMessages] = useState(null);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [messages, setMessages] = useState({
    is_updating: false,
    status: "Checking for updates..."}
  );

  // track changes in update state
  const prevIsUpdatingRef = useRef(messages.is_updating);

  useEffect(() => {
    // if messages.is_updating becomes false, then updating is done, redirect to home page
    if (prevIsUpdatingRef.current && !messages.is_updating) {
      const timeout = setTimeout(() => {
        window.location.href = "/";
      }, 2000); // wait for 2 seconds for redirect

      // cleanup timeout
      return () => clearTimeout(timeout);
    }
    // Update the ref to hold the current state
    prevIsUpdatingRef.current = messages.is_updating;

  }, [messages.is_updating])

  useEffect(() => {
    async function fetchVersion() {
      const versionInfo = await orcVersion(api);
      console.log(versionInfo)
      setIsLoading(false);
      if (versionInfo?.error) {
        setUpdateAvailable(false)
        setUpdateStatusMessages("Too many API calls to GitHub, please wait for some time until trying again")
      }
      if (!versionInfo?.online) {
        console.log("Error fetching version info, we seem to be offline");
        setUpdateAvailable(null);  // info not available
        setUpdateStatusMessages(null);
      } else {

        setCurrentVersion(versionInfo.current_version)
        setNewVersion(versionInfo.latest_version)
        setUpdateAvailable(versionInfo.update_available)
        if (versionInfo.update_available) {
          setReleaseNotes(versionInfo?.release_data?.body)  // only if new version is available
        }

      }
      // check for updates and current version
    }
    setIsLoading(true);

    fetchVersion();
    const timeout = setTimeout(() => {
      const ws = createWebSocketConnection(`ws://${window.location.hostname}:5000/updates/status_ws`, setMessages);
      // });
      // Cleanup when component unmounts
      return () => {
        if (ws) {
          ws.close();
          console.log("WebSocket connection closed")
        }
      };
    }, 100);
    return () => clearTimeout(timeout);

  }, []);


  async function handleUpdate() {
    setButtonDisabled(true);
    try {
      await startUpdate(api)
    } catch (error) {
      console.log("Error starting update: " + error);
      setUpdateStatusMessages(error);
    }
  };

  return (
    <>

    {(prevIsUpdatingRef.current || messages.is_updating) && (
      // only show the update spinner when updating
      <div className="spinner-viewport">
        <div className="spinner" />
        <div>{messages.status}</div>
      </div>
    )}

  <div className="flex-container column">

      <h1>Software Update</h1>

      {// show spinner when update info is fetched from GitHub
        isLoading ? (
        <div>
          <div className="spinner-container" style={{position: "relative"}}>
          <div className="spinner"></div>
          </div>
          <p>Checking for updates...</p>
        </div>
      ) : (
        <>
            <div className="flex-container no-padding">
              <div>
              <div className="update-info">
                <p>
                  <strong>Current Version:</strong> v{currentVersion}
                </p>
                <p>
                  <strong>Newest version available:</strong> v{newVersion}
                </p>
              </div>
              <button
                className="btn"
                disabled={!updateAvailable || messages.is_updating || buttonDisabled}
                onClick={handleUpdate}
              >
                Update Now
              </button>
              {!messages.is_updating && updateAvailable === false && (
              <div className="no-update">
                Your software is already up to date.
              </div>
              )}
              {updateStatusMessages !== null && (
                <div className="no-update error">
                  Error fetching update info: {updateStatusMessages}
                </div>
              )}

              {(updateAvailable === null) && (
                <div className="no-update error">
                  Not able to fetch update information. Please ensure you are online.
                </div>
                )}

            </div>
            </div>
          <div className="release-notes">
            <strong>Release Notes: v{newVersion}</strong>
            <hr></hr>
            <ReactMarkdown>{releaseNotes}</ReactMarkdown>
            {/*<pre>{releaseNotes}</pre>*/}
          </div>
        </>
      )}
    </div>
    </>

  )
}
export default Updates;
