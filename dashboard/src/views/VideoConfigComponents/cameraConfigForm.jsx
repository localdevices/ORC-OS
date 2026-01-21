import {useDebouncedWsSender} from "../../api/api.js";
import React, {useEffect, useState} from "react";
import PropTypes from "prop-types";
import '../cameraAim.scss'

const CameraConfigForm = ({selectedCameraConfig, setSelectedCameraConfig, setMessageInfo, ws}) => {
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

  // Utility function to safely parse JSON
  const safelyParseJSON = (jsonString) => {
    try {
      return JSON.parse(jsonString); // Parse if valid JSON string
    } catch (error) {
      console.warn("Invalid JSON string:", error);
      return jsonString; // Fallback: Leave it as the original string
    }
  };

  const submitData = (formData) => {
    return {
      id: formData.id || null,
      name: formData.name,
      data: safelyParseJSON(formData.data),
    }
  }

  const handleInputChange = async (event) => {
    const {name, value} = event.target;
    console.log("TRIGGERED CHANGE WITH", name, value)
    const updatedFormData = {
      ...formData,
      [name]: value
    }
    setFormData(updatedFormData);
    const msg = {
      "action": "update_video_config",
      "op": "set_field",
      "params": {
        "video_patch": {
          "video_config": {
            "camera_config": {[name]: name === "data" ? safelyParseJSON(value) : value}
          }
        },
        "update": name === "data" ? false : true
      }
    }
    sendDebouncedMsg(msg);

    //
    // try {
    //   const response = await api.post('/camera_config/update/', submitData(updatedFormData));
    //   setSelectedCameraConfig(response.data);
    // } catch (error) {
    //   console.error('Error updating JSON:', error);
    // }
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
        console.log("FILE:", file)
        // const formData = new FormData(); // Prepare form data for file upload
        // formData.append("file", file);
        // read data and convert into JSON and set on formData.data
        const reader = new FileReader();
        reader.onload = function (e) {
          const rawText = e.target.result;
          // verify the text is properly formatted JSON
          try {
            const parsedJson = safelyParseJSON(rawText);
            console.log("Parsed JSON:", parsedJson);
          } catch (error) {
            console.error("Invalid JSON format:", error);
            setMessageInfo('error', 'Invalid JSON format');
            return;
          }
          // setFormData({...formData, data: rawText});
          handleInputChange({target: {name: "data", value: rawText}});

          // console.log("JSON: ", e.target.result)
          // const updatedFormData = {
          //   ...formData,
          //   data: e.target.result
          // }
          // formData.append("data", e.target.result);
        }
        reader.readAsText(file);

        // try {
        //   const response = await api.post(
        //     url,
        //     formData,
        //     {headers: {"Content-Type": "multipart/form-data",},}
        //   );
        //   if (response.status === 201) {
        //     // set the camera config data (only data, not id and name)
        //     // setSelectedCameraConfig(prevState => ({
        //     //     ...prevState,
        //     //     data: response.data.data
        //     //   }))
        //     const { id, name, remote_id, created_at, sync_status, ...updatedData } = response.data
        //     setSelectedCameraConfig(updatedData);
        //   } else {
        //     console.error("Error occurred during file upload:", response.data);
        //     setMessageInfo('error', response.data.detail);
        //
        //   }
        // } catch (error) {
        //   console.error("Error occurred during file upload:", error);
        //   setMessageInfo('error', `Error: ${error.response.data.detail}`);
        // }

      }
    });
    // trigger input dialog box to open
    input.click();
  }

  const handleFormSubmit = async (event) => {
    event.preventDefault();
    // Dynamically filter only fields with non-empty values
    event.preventDefault();
    try {
      ws.sendJson({"action": "save", "params": {}});
    //
    //   const filteredData = Object.fromEntries(
    //   Object.entries(formData).filter(([key, value]) => value !== '' && value !== null)
    // );
    // // predefine response object
    // let response;
    // try {
    //   if (filteredData.id === undefined) {
    //     response = await api.post('/camera_config/', submitData(filteredData));
    //   } else {
    //     response = await api.patch(`/recipe/${filteredData.id}`, submitData(filteredData));
    //   }
    //   if (response.status !== 201 && response.status !== 200) {
    //     const errorData = await response.json()
    //     throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
    //   }
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
