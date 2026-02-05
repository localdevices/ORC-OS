import {useDebouncedWsSender} from "../../api/api.js";
import {useEffect, useState} from "react";
import PropTypes from "prop-types";
import '../cameraAim.scss'
import {safelyParseJSON} from "../../utils/helpers.jsx";

const CameraConfigForm = ({selectedCameraConfig, setMessageInfo, ws}) => {
  const [formData, setFormData] = useState({
    name: '',
    id: '',
    data: ''
  });
  const [showJsonData, setShowJsonData] = useState(false);
  // create a delayed websocket sender for this component
  const sendDebouncedMsg = useDebouncedWsSender(ws, 400);

  useEffect(() => {
    if (selectedCameraConfig) {
      setFormData({
        name: selectedCameraConfig.name || '',
        id: selectedCameraConfig.id || '',
        data: JSON.stringify(selectedCameraConfig.data, null, 4) || '',
      });
    } else {
      setFormData({
        name: '',
        id: '',
        data: '',
      })
    }

  }, [selectedCameraConfig]);



  const handleInputChange = async (event) => {
    const {name, value} = event.target;
    const updatedFormData = {
      ...formData,
      [name]: value
    }
    setFormData(updatedFormData);
    const msg = {
      "action": "update_video_config",
      "op": "set_camera_config_data",
      "params": {
        "data": safelyParseJSON(value)
      }
    }
    sendDebouncedMsg(msg);
  }
  const loadModal = async () => {
    const input = document.createElement('input');
    input.type = "file";
    input.accept = ".json";
    // const url = '/camera_config/from_file/'
    // Wait for the user to select a file
    input.addEventListener('change', async (event) => {

      // input.onchange = async (event) => {
      const file = event.target.files[0]; // Get the selected file
      if (file) {
        // read data and convert into JSON and set on formData.data
        const reader = new FileReader();
        reader.onload = function (e) {
          const rawText = e.target.result;
          // verify the text is properly formatted JSON
          try {
            safelyParseJSON(rawText);
          } catch (error) {
            console.error("Invalid JSON format:", error);
            setMessageInfo('error', 'Invalid JSON format');
            return;
          }
          handleInputChange({target: {name: "data", value: rawText}});
        }
        reader.readAsText(file);
      }
    });
    // trigger input dialog box to open
    input.click();
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    try {
      ws.sendJson({"action": "save", "params": {}});
      setMessageInfo('success', 'Camera config stored successfully');
    } catch (err) {
      setMessageInfo('Error while storing camera config', err.response.data);
    }
  };

  const handleSaveToJson = async (event) => {
    // save camera calibration to a json file, by creating a programmatic link, download it, and remove it again.
    event.preventDefault();
    const content = formData.data;
    const blob = new Blob([content], {type: 'application/json'});
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cameraConfig.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className='container tab'>
      <h5>Load from or save to JSON</h5>
      <p>Load camera calibration from a PyORC compatible JSON or save to JSON, e.g. for reanalysis of large
      amounts of videos
      </p>

      <button className="btn btn-primary" onClick={loadModal}
      >
        Load from JSON
      </button>
      <button className="btn btn-primary" onClick={handleSaveToJson}
      >
        Save to JSON
      </button>

      <form onSubmit={handleFormSubmit}>
        <div className='mb-3 mt-3'>
          <label htmlFor='id' className='form-label'>
            Camera Config ID
          </label>
          <input type='str' className='form-control' id='id' name='id' value={formData.id} disabled />
        </div>
        <div className='mb-3 mt-3'>
          <label htmlFor='name' className='form-label'>
            Name of camera configuration
          </label>
          <input type='str' className='form-control' id='name' name='name' onChange={handleInputChange} value={formData.name} required />
        </div>
        <button type='submit' className='btn'>
          Save
        </button>
        <div className='mb-3 mt-3'>Toggle JSON edits (advanced users only)
          <div className="form-check form-switch">
            <label className="form-label" htmlFor="toggleJson" style={{ marginLeft: '0' }}></label>
            <input
              style={{width: "40px", height: "20px", borderRadius: "15px"}}
              className="form-check-input"
              type="checkbox"
              role="switch"
              id="toggleJson"
              onClick={() => setShowJsonData(!showJsonData)}
            />
          </div>
        </div>

        {showJsonData && (
          <div className="mb-3">
            <label htmlFor="data" className="form-label">JSON Data</label>
            <textarea
              id="data"
              name="data"
              className="form-control"
              rows="40"
              value={formData.data}
              onChange={handleInputChange}
            ></textarea>
          </div>
        )}
        <div>
        </div>

      </form>
    </div>

  )

};

export default CameraConfigForm;

CameraConfigForm.propTypes = {
  selectedCameraConfig: PropTypes.object.isRequired,
  setMessageInfo: PropTypes.func.isRequired,
  ws: PropTypes.object.isRequired,
};
