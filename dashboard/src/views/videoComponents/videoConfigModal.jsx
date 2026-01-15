import {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import api from "../../api/api.js";
import {DropdownMenu} from "../../utils/dropdownMenu.jsx"

import Modal from "react-modal";
import PropTypes from "prop-types";
import {FaSpinner} from "react-icons/fa";


export const VideoConfigModal = ({showModal, setShowModal, saving, setSaving, video, handleConfigSelection}) => {
  const [loading, setLoading] = useState(false);
  const [availableVideoConfigs, setAvailableVideoConfigs] = useState([]);

  // set navigation
  const navigate = useNavigate();

  // Fetch the existing video configs when the modal is opened
  useEffect(() => {
    setLoading(true);
    setSaving(false);
    api.get("/video_config/") // Replace with your endpoint for fetching video configs
      .then((response) => {
        setAvailableVideoConfigs(response.data);
        setLoading(false);
      })
      .catch((error) => {
        setLoading(false);
        console.error("Error fetching video configs:", error);
      });
  }, []);


  const createNewVideoConfig = (video_id) => {
    // redirect to editing or creating page for video config
    navigate(`/video_config/${video_id}`);
  }


  return (
    <>
      {/*Modal for selecting a VideoConfig or creating a new Video Config*/}
      {/* Modal for video config */}
      <Modal
        isOpen={showModal}
        onRequestClose={() => {
          setShowModal(false);
          setSaving(false);
        }
      }
        contentLabel="Video Configurations"

        style={{
          overlay: {
            backgroundColor: "rgba(0, 0, 0, 0.6)",
          },

          content: {
            maxWidth: "600px",
            maxHeight: "400px",
            margin: "auto",
            padding: "20px",
          },
        }}
      >

        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
          <h2>Video Configurations</h2>
          <button
            style={{
              background: "none",
              border: "none",
              fontSize: "1.5rem",
              cursor: "pointer",
              lineHeight: "1",
            }}
            onClick={() => setShowModal(false)}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        {video && <p>Configuring Video: {video.id}</p>}
        {video?.video_config?.id ?
          video?.video_config?.sample_video_id === video?.id ? (
            <div role="alert" style={{"color": "blue"}}><p>{`This is the reference video for config: ${video.video_config.id}: ${video.video_config.name}. Click edit to modify.`}</p></div>
          ) : (
            <div role="alert" style={{"color": "green"}}><p>{`Current selected config: ${video.video_config.id}: ${video.video_config.name}`}</p></div>

          ) : (<div role="alert" style={{"color": "red"}}><p>No config selected. Select one below or start editing a new config.</p></div>)}
        <h5>Select an Existing Config:</h5>
        <div className="mb-3 mt-0">
          {loading ? (
            <div><FaSpinner style={{color: "blue", animation: "spin 1s linear infinite"}}/> Loading video configs...</div>
          ) : (
            <DropdownMenu
              callbackFunc={(e) => {
                setSaving(true);
                handleConfigSelection(e)
              }}
              data={availableVideoConfigs}
              value={video && video?.video_config ? video.video_config.id : ""}
              noSelectionText={"-- Select no config --"}
            />
          )}
        </div>
        <div className="container">
          <h5>Create new or edit existing config:</h5>
          <button className="btn" disabled={saving} onClick={() => createNewVideoConfig(video.id)}>Edit</button>
            {saving && (<><FaSpinner style={{color: "blue", animation: "spin 1s linear infinite"}}/> Saving...</>)}
        </div>
      </Modal>
    </>
  )
}
VideoConfigModal.propTypes = {
  showModal: PropTypes.bool.isRequired,
  setShowModal: PropTypes.func.isRequired,
  saving: PropTypes.bool.isRequired,
  setSaving: PropTypes.func.isRequired,
  video: PropTypes.object,
  handleConfigSelection: PropTypes.func.isRequired,
};
