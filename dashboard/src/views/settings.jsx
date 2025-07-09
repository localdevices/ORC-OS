import React, {useState, useEffect} from 'react';
import api from '../api';
import {DropdownMenu} from "../utils/dropdownMenu.jsx";
import {useMessage} from '../messageContext';
import '../App.css';

const Settings = () => {

  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true); // State for loading indicator
  const [error, setError] = useState(null); // State for error handling
  const [videoConfigs, setVideoConfigs] = useState([]);
  const [formData, setFormData] = useState({
    video_file_fmt: '',
    allowed_dt: '',
    shutdown_after_task: false,
    parse_dates_from_file: true,
    reboot_after: '',
    video_config_id: '',
    remote_site_id: '',
    sync_file: false,
    sync_image: false,
    active: false

  });
  // set message box
  const {setMessageInfo} = useMessage();

  const fetchSettings = async () => {
    const response = await api.get('/settings/');
    setSettings(response.data);
    console.log(response.data);
  };

  useEffect(() => {
    fetchSettings();
    // also get available video configs
    const response = api.get('/video_config/');
    response.then(response => {
      const filteredConfigs = response.data.filter(config => config.ready_to_run === true);
      setVideoConfigs(filteredConfigs);
    });

  }, []);
  useEffect(() => {
    if (settings) {
      setFormData({
        video_file_fmt: settings.video_file_fmt || '',
        allowed_dt: settings.allowed_dt || '',
        shutdown_after_task: settings.shutdown_after_task || false,
        parse_dates_from_file: settings.parse_dates_from_file || false,
        reboot_after: settings.reboot_after || '',
        video_config_id: settings.video_config_id || '',
        remote_site_id: settings.remote_site_id || '',
        sync_file: settings.sync_file || false,
        sync_image: settings.sync_image || false,
        active: settings.active || false

      });
    }
  }, [settings]);

  const handleInputChange = (event) => {
    console.log(event.target.checked, event.target.value);
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    console.log(value);
    setFormData({
      ...formData,
      [event.target.name]: value,
    });
  }
  const handleInputDropdown = (event) => {
    const {name, value, type} = event.target;
    event.target.value = value;
    setFormData({
      ...formData,
      ["video_config_id"]: value
    });
  }
  const handleInputIntChange = (event) => {
    const {name, value, type} = event.target;
    event.target.value = value;
    setFormData({
      ...formData,
      [name]: type === "number" ? parseInt(value) : value
    });
  };

  const validateSettings = () => {
    // daemon runner can only be active when video format, allowed time difference, and video config is set
    // to a valid input
    if (formData.video_file_fmt && formData.allowed_dt && formData.video_config_id) {
      return true;
    }
    return false;
  }
  const handleFormSubmit = async (event) => {
    try {
      event.preventDefault();
      console.log(formData);
      // check if activate conditions are met
      if (!validateSettings()) {
        // hard set to false. we cannot yet run autonomously.
        formData.active = false;
      }
      // Dynamically filter only fields with non-empty values
      const filteredData = Object.fromEntries(
        Object.entries(formData).map(([key, value]) => [key, value === '' ? null : value])
      );
      //
      // const filteredData = Object.fromEntries(
      //   Object.entries(formData).filter(([key, value]) => value !== '' && value !== null)
      // );
      console.log(filteredData);
      const response = await api.post('/settings/', filteredData);
      if (!response.status === 200) {
        const errorData = await response.json()
        throw new Error(errorData.message || `Invalid form data. Status Code: ${response.status}`);
      }
      setMessageInfo('success', 'Settings information updated successfully!');

      // read back the device after posting
      fetchSettings();
      // set the form data to new device settings
      setFormData({
        video_file_fmt: '',
        allowed_dt: '',
        shutdown_after_task: false,
        parse_dates_from_file: false,
        reboot_after: '',
        video_config_id: '',
        remote_site_id: '',
        sync_file: false,
        sync_image: false,
        active: false
      });
    } catch (err) {
      setMessageInfo('error', err.response.data);
    }
  };
  return (
    <div className='container'>
      <h2>Daemon settings</h2>
      Change your Daemon settings for automated processing of videos here.
      <div className="flex-container column">
        <form onSubmit={handleFormSubmit}>
          <h5>File naming</h5>
          <div className='mb-3 mt-3'>
            <label htmlFor='video_file_fmt' className='form-label'>
              Expected video file format
            </label>
            <input
              type='text'
              className='form-control'
              id='video_file_fmt'
              name='video_file_fmt'
              placeholder="{%Y%m%dT%H%M%S}.mp4"
              onChange={handleInputChange}
              value={formData.video_file_fmt}
            />
            <div className="help-block">
              Check <a href="https://docs.python.org/3/library/datetime.html#strftime-and-strptime-behavior"
                       target="_blank" rel="noreferrer">here
            </a> for valid datetime string formats.
            </div>
          </div>

          <div className='mb-3 mt-3'>
            <input
              type='checkbox'
              className='form-check-input'
              id='parse_dates_from_file'
              name='parse_dates_from_file'
              onChange={handleInputChange}
              value={formData.parse_dates_from_file}
              checked={formData.parse_dates_from_file}
              style={{marginRight: '10px'}}
            />
            <label htmlFor='parse_dates_from_file' className='form-label'>
              Parse dates from the video file name.
            </label>
            <div className="help-block">
              File must have a name template such as "{"{%Y%m%dT%H%M%S}.mp4"}"
            </div>
          </div>
            {formData.video_file_fmt && settings?.sample_file && (
              <div className="mb-3 mt-3 form-horizontal">
                  <div role="alert" style={{color: "red", fontStyle: "italic"}}>
                      Expected file name for current date and time on the device is "{settings.sample_file}".
                      Make sure that videos of this form are generated on the device.
                  </div>
              </div>
            )}

          <h5>Daemon settings</h5>

          <div className='mb-3 mt-3'>
            <label htmlFor='allowed_dt' className='form-label'>
              Allowed time difference between video and water level time stamps
            </label>
            <input type='number' className='form-control' id='allowed_dt' name='allowed_dt'
                   onChange={handleInputIntChange} value={formData.allowed_dt}/>
            <div className="help-block">
              Videos that cannot be matched with a water level are only processed if optical water level
              detection is allowed. Select an optical water level cross section in your video configuration.
            </div>
          </div>
          <div className='mb-3 mt-3'>
            <input
              type='checkbox'
              className='form-check-input'
              id='shutdown_after_task'
              name='shutdown_after_task'
              onChange={handleInputChange}
              value={formData.shutdown_after_task}
              checked={formData.shutdown_after_task}
              style={{marginRight: '10px'}}
            />
            <label htmlFor='shutdown_after_task' className='form-label'>
              Shutdown the device after an automated task.
            </label>
            <div className="help-block">
              Choosing this implies that you use power cycling and one video per cycle in processing. Please check this
              carefully.
            </div>
          </div>
          <div className='mb-3 mt-3'>
            <label htmlFor='reboot_after' className='form-label'>
              Reboot device after some time [sec]. Just in case a system fails, the device may go back online after this
              time.
            </label>
            <input type='number' className='form-control' id='reboot_after' name='reboot_after' step="1"
                   onChange={handleInputIntChange} value={formData.reboot_after}/>
          </div>
          <div className='mb-3 mt-3'>
            <DropdownMenu
              dropdownLabel={"Video configurations."}
              callbackFunc={handleInputDropdown}
              data={videoConfigs}
              value={formData.video_config_id}
            />
            <div className="help-block">
              Only entirely completed configurations can be selected here.
            </div>
          </div>

          <h5>LiveORC settings</h5>

          <div className='mb-3 mt-3'>
            <label htmlFor='remote_site_id' className='form-label'>
              Site ID (number) of the site, as known on configured LiveORC server.
            </label>
            <input type='number' className='form-control' id='remote_site_id' name='remote_site_id' step="1"
                   onChange={handleInputIntChange} value={formData.remote_site_id}/>
            <div className="help-block">
              Make sure you have access to a LiveORC server, and can write to a site. Note down the Site ID from the
              site's address bar.
            </div>

          </div>
          <div className='mb-3 mt-3'>
            <input
              type='checkbox'
              className='form-check-input'
              id='sync_file'
              name='sync_file'
              onChange={handleInputChange}
              value={formData.sync_file}
              checked={formData.sync_file}
              style={{marginRight: '10px'}}
            />
            <label htmlFor='sync_file' className='form-label'>
              Synchronize Video file with LiveORC server (if configured)
            </label>
          </div>
          <div className='mb-3 mt-3'>
            <input
              type='checkbox'
              className='form-check-input'
              id='sync_image'
              name='sync_image'
              onChange={handleInputChange}
              value={formData.sync_image}
              checked={formData.sync_image}
              style={{marginRight: '10px'}}
            />
            <label htmlFor='sync_image' className='form-label'>
              Synchronize result image file with LiveORC server (if configured)
            </label>
          </div>
          <div className='mb-3 mt-3'>Activate the daemon runner.
            <div className="form-check form-switch">
              <label className="form-label" htmlFor="active" style={{marginLeft: '0'}}></label>
              <input
                style={{width: "40px", height: "20px", borderRadius: "15px"}}
                className="form-check-input"
                type="checkbox"
                id="active"
                name="active"
                onChange={handleInputChange}
                value={validateSettings() ? (formData.active) : false}
                checked={validateSettings() ? (formData.active) : false}
                disabled={!validateSettings()}
              />
            </div>
            {validateSettings() ? (
              <div className="help-block">
                You can switch on the daemon after entering a valid expected file format and allowed time difference and a complete video configuration.
              </div>
              ) : (
              <div className="help-block">
                Switch on the daemon and save settings if you are ready.
              </div>

              )
            }
          </div>

          <button type='submit' className='btn'>
            Submit
          </button>

        </form>
      </div>
    </div>

  );
};
export default Settings;
