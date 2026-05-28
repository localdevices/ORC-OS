import {FaExclamationTriangle} from 'react-icons/fa';
import {useState, useEffect, useRef, useMemo} from 'react';
import ReactMarkdown from 'react-markdown';

import api, {createWebSocketConnection} from '../api/api.js';
import {startUpdate} from '../utils/apiCalls/update.jsx';
import {DropdownMenu} from '../utils/dropdownMenu.jsx';
import "./updates.css";
import '../App.css';


function normalizeVersion(version) {
  if (version === null || version === undefined) {
    return "";
  }
  // in case prefix is 'v' remove prefix
  return String(version).trim().replace(/^v/i, "");
}

function compareVersions(a, b) {
  // Normalize and split versions into parts, converting to integers, used for comparing versions.
  const aParts = normalizeVersion(a).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const bParts = normalizeVersion(b).split(".").map((part) => Number.parseInt(part, 10) || 0);
  const n = Math.max(aParts.length, bParts.length);

  for (let i = 0; i < n; i += 1) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;
    if (av > bv) {
      return 1;
    }
    if (av < bv) {
      return -1;
    }
  }
  return 0;
}


function getStatusColor(status) {
  const normalized = String(status || "").toUpperCase();
  if (normalized === "WARNING") {
    return "#f59f00";
  }
  if (normalized === "ERROR" || normalized === "OUTDATED") {
    return "#dc3545";
  }
  return "inherit";
}


const Updates = ({ currentVersion }) => {
  const [newVersion, setNewVersion] = useState(null);
  const [releaseData, setReleaseData] = useState([]);
  const [selectedReleaseTag, setSelectedReleaseTag] = useState("");
  const [selectedReleaseInfo, setSelectedReleaseInfo] = useState(null);
  const [preflightResult, setPreflightResult] = useState(null);
  const [isPreflightLoading, setIsPreflightLoading] = useState(false);
  const [preflightError, setPreflightError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [updateStatusMessages, setUpdateStatusMessages] = useState(null);
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const [messages, setMessages] = useState({
    is_updating: false,
    status: "Checking for updates..."
  });

  // track changes in update state
  const prevIsUpdatingRef = useRef(messages.is_updating);

  const dropdownItems = useMemo(() => {
    // create dropdown items from API response of list of release tags
    return (releaseData || []).map((release, index) => ({
      id: index + 1,
      value: release.tag_name,
      name: `Date ${release.published_at.slice(0, 10)}`,
      // name: "",
    }));
  }, [releaseData]);

  const currentVersionHigherThanSelected = useMemo(() => {
    // compare current version with selected release version to determine if update should be blocked
    if (!currentVersion || !selectedReleaseTag) {
      return false;
    }
    return compareVersions(currentVersion, selectedReleaseTag) > 0;
  }, [currentVersion, selectedReleaseTag]);

  const currentVersionEqualToSelected = useMemo(() => {
    // compare current version with selected release version to determine if update should be blocked
    if (!currentVersion || !selectedReleaseTag) {
      return false;
    }
    return compareVersions(currentVersion, selectedReleaseTag) === 0;
  }, [currentVersion, selectedReleaseTag]);


  const selectedReleaseAllowed = useMemo(() => {
    // determine if the selected release is allowed based on preflight results
    if (!preflightResult) {
      return false;
    }
    if (preflightResult.ok_to_update === false) {
      return false;
    }
    return true;
  }, [preflightResult]);

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
  }, [messages.is_updating]);


  useEffect(() => {
    async function fetchInitialData() {
      try {
        const releasesResponse = await api.get("/updates/releases/");
        const releases = releasesResponse?.data?.releases || [];
        setReleaseData(releases);

        if (releases.length > 0) {
          const latest = releases[0];
          // at mounting, default to the latest release available
          setSelectedReleaseTag(latest.tag_name);
          setSelectedReleaseInfo(latest);
          setNewVersion(latest.tag_name);
          const latestReleaseResponse = await api.get(`/updates/releases/${latest.tag_name}/`);
          setSelectedReleaseInfo(latestReleaseResponse.data);
        }
      } catch (error) {
        console.error("Error fetching update info: ", error);
        setUpdateStatusMessages(error?.message || "Error fetching update info");
      } finally {
        setIsLoading(false);
      }
    }

    setIsLoading(true);
    fetchInitialData();
    const timeout = setTimeout(() => {
      const ws = createWebSocketConnection("updates", "/updates/status_ws/", setMessages);
      return () => {
        if (ws) {
          ws.close();
          console.log("WebSocket connection closed.");
        }
      };
    }, 100);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // run preflight checks for selected release and update states
    async function fetchPreflight() {
      if (!selectedReleaseTag) {
        return;
      }
      setIsPreflightLoading(true);
      setPreflightError(null);
      // TODO: remove commented code below if indeed not needed.
      try {
        // const selected = (releaseData || []).find((release) => release.tag_name === selectedReleaseTag) || null;
        // setSelectedReleaseInfo(selected);

        const preflightResponse = await api.get(`/updates/preflight/${selectedReleaseTag}/`);
        setPreflightResult(preflightResponse.data);
        const releaseResponse = await api.get(`/updates/releases/${selectedReleaseTag}/`);
        setSelectedReleaseInfo(releaseResponse.data);
      } catch (error) {
        setPreflightResult(null);
        setPreflightError(error?.response?.data?.detail || error?.message || "Could not run preflight checks");
      } finally {
        setIsPreflightLoading(false);
      }
    }

    fetchPreflight();
  }, [selectedReleaseTag]);  // , releaseData

  function handleReleaseChange(event) {
    // event handler for tag selection from dropdown
    setSelectedReleaseTag(event.target.value);
  }

  async function handleUpdate() {
    setButtonDisabled(true);
    try {
      console.log("Starting update for release tag: ", selectedReleaseTag);
      await startUpdate(selectedReleaseTag);
    } catch (error) {
      setUpdateStatusMessages(error?.message || String(error));
      // setButtonDisabled(false);
    } finally {
      setButtonDisabled(false);
    }
  }

  const disableUpdateBtn = (
    buttonDisabled
    || messages.is_updating  // already updating
    || !selectedReleaseTag  // no release selected
    || isPreflightLoading  // preflight checks are still running, no update allowed until accepted
    || !selectedReleaseAllowed  // preflight checks did not pass
    || currentVersionHigherThanSelected  // selected release is older than current version, rollbacks are NOT supported
  );

  const selectedReleaseNotes = selectedReleaseInfo?.body || selectedReleaseInfo?.release_notes || "";

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
              <div style={{width: "100%"}}>
              <div className="service-warning">
                <p><FaExclamationTriangle color="red"/> Before updating consider the following:
                <ul>
                  <li>make sure you first STOP and DISABLE any power management mode or any other mode causing
                    autonomous shutdowns or reboots. This is because during updating the device should not shutdown,
                    and because during restarting, recompilation may be required, which takes a few
                    minutes of time.
                  </li>
                  <li>
                    Make sure your device has sufficient battery and a stable internet connection.
                  </li>
                  <li>
                    Consider backing up your database before updating.
                  </li>
                </ul>
                </p>

              </div>

                <div className="update-info">
                  <DropdownMenu
                    dropdownLabel={"Select available releases"}
                    callbackFunc={handleReleaseChange}
                    data={dropdownItems}
                    value={selectedReleaseTag}
                    allowNoSelection={false}
                    disabled={dropdownItems.length === 0}
                  />
                </div>

                <div className="update-info">
                  <p>
                    <strong>You are now running version:</strong> v{currentVersion}
                  </p>
                  <p>
                    <strong>Newest version available:</strong> {newVersion}
                  </p>
                  <p>
                    <strong>Selected release:</strong> {selectedReleaseTag || "None"}
                  </p>
                  {selectedReleaseInfo && (
                    <>
                      <p>
                        <strong>Published:</strong> {selectedReleaseInfo.published_at || "Unknown"}
                      </p>
                      {/* <p>
                        <strong>Pre-release:</strong> {selectedReleaseInfo.prerelease ? "Yes" : "No"}
                      </p> */}
                    </>
                  )}
                </div>

                <div className="release-notes">
                  <strong>Preflight checks for {selectedReleaseTag || "selected release"}</strong>
                  <hr></hr>
                  {isPreflightLoading && <p>Running preflight checks...</p>}
                  {!isPreflightLoading && preflightError && (
                    <p className="no-update error">{preflightError}</p>
                  )}

                  {!isPreflightLoading && !preflightError && (preflightResult?.results || []).length > 0 && (
                    <ul style={{paddingLeft: "1rem", marginBottom: "0"}}>
                      {(preflightResult?.results || []).map((result) => (
                        <li
                          key={result.check_id}
                          style={{color: getStatusColor(result.status), marginBottom: "0.4rem"}}
                        >
                          <strong>{result.status}</strong>: {result.message}{result.remedy ? (` - `) : ""}<strong>{result.remedy ? `Remedy: ${result.remedy}` : ""}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {currentVersionHigherThanSelected && (
                  <div className="no-update error">
                    The selected version is older than your current version. Update is disabled.
                  </div>
                )}
                {currentVersionEqualToSelected && (
                  <div className="update error">
                    You are already running the selected version. Update will re-attempt installation in case of any suspected issues.
                  </div>
                )}

                {!isPreflightLoading && !selectedReleaseAllowed && selectedReleaseTag && (
                  <div className="no-update error">
                    Update is blocked by preflight checks for this release.
                  </div>
                )}

                <button
                  className="btn btn-primary"
                  disabled={disableUpdateBtn}
                  onClick={handleUpdate}
                >
                  Update Now
                </button>

                {updateStatusMessages !== null && (
                  <div className="no-update error">
                    Error fetching update info: {updateStatusMessages}
                  </div>
                )}
              </div>
            </div>

            <div className="release-notes">
              <strong>Release Notes: {selectedReleaseTag || `v${newVersion || ""}`}</strong>
              <hr></hr>
              {selectedReleaseNotes ? (
                <ReactMarkdown>{selectedReleaseNotes}</ReactMarkdown>
              ) : (
                <p>No release notes available for this release.</p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default Updates;
