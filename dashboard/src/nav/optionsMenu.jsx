import { FaSave, FaClock, FaCog, FaWater, FaCloudUploadAlt, FaTools, FaCogs } from "react-icons/fa";
import { TbPrompt } from "react-icons/tb";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from '../api/api.js';


export const OptionsMenu = ({ devStatus }) => {
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const [services, setServices] = useState([]);
  const navigate = useNavigate();
  // delay on closure of the User menu to prevent closing when hovering over the menu items
  let optionsMenuCloseTimer = null;


  useEffect(() => {
    api.get("/service/")
      .then((response) => {
        console.log(response.data);
        setServices(response.data);
      })
      .catch((error) => console.error("Error fetching services:", error));
  }, []);

  const openSetting = (uri) => {
    navigate(uri);
    setOptionsMenuOpen(false);
  }
  return (
    <div
      className="user-menu-wrapper"
      onMouseEnter={() => {
        if (optionsMenuCloseTimer) {
          clearTimeout(optionsMenuCloseTimer);
          optionsMenuCloseTimer = null;
        }
        setOptionsMenuOpen(true)
      }
      }
      onMouseLeave={() => {
        optionsMenuCloseTimer = setTimeout(() => {
          setOptionsMenuOpen(false)
        }, 100);
      }}
    >
      <FaCog style={{ cursor: 'pointer' }} />
      {optionsMenuOpen && (
        <div className="user-menu">
          <div
            className="user-menu-item"
            onClick={() => { openSetting("/settings") }}
            onKeyDown={() => { openSetting("/settings") }}
            role="button"
          >
            <FaClock style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Daemon
          </div>
          <div
            className="user-menu-item"
            onClick={() => { openSetting("/disk_management") }}
            onKeyDown={() => { openSetting("/disk_management") }}
            role="button"
          >
            <FaSave style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Disk management
          </div>
          <div
            className="user-menu-item"
            onClick={() => { openSetting("/water_level") }}
            onKeyDown={() => { openSetting("/water_level") }}
            role="button"
          >
            <FaWater style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Water level
          </div>
          <div
            className="user-menu-item"
            onClick={() => { openSetting("/callback_url") }}
            onKeyDown={() => { openSetting("/callback_url") }}
            role="button"
          >
            <FaCloudUploadAlt style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            LiveORC API
          </div>
          <div
            className="user-menu-item"
            onClick={() => { openSetting("/updates") }}
            onKeyDown={() => { openSetting("/updates") }}
            role="button"
          >
            <FaTools style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Updates
          </div>
          {devStatus && (
            <div
              className="user-menu-item"
              onClick={() => { openSetting("/services") }}
              onKeyDown={() => { openSetting("/services") }}
              role="button"
            >
              <FaCogs style={{ color: 'orange', marginRight: '8px', verticalAlign: 'middle' }} />
              Manage services
            </div>
          )}
          {services.length > 0 && (
            <div>
              <div className="user-menu-item">Background services:</div>
              {services.map((service) => (
                <div
                  className="user-menu-item"
                  onClick={() => { openSetting(`/services/${service.id}`) }}
                  onKeyDown={() => { openSetting(`/services/${service.id}`) }}
                  role="button"
                >
                  <TbPrompt style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                  {service.service_short_name[0].toUpperCase() + service.service_short_name.slice(1)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
