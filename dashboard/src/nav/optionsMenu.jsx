import {FaSave, FaClock, FaCog, FaWater, FaCloudUploadAlt, FaTools} from "react-icons/fa";

import {useState} from "react";
import { useNavigate } from "react-router-dom";

export const OptionsMenu = () => {
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const navigate = useNavigate();
  // delay on closure of the User menu to prevent closing when hovering over the menu items
  let optionsMenuCloseTimer = null;

  return (
    <div
      className="user-menu-wrapper"
      onMouseEnter={() => {
        if (optionsMenuCloseTimer) {
          clearTimeout(optionsMenuCloseTimer);
          optionsMenuCloseTimer = null;
        }
        setOptionsMenuOpen(true)}
      }
      onMouseLeave={() => {
        optionsMenuCloseTimer = setTimeout(() => {
          setOptionsMenuOpen(false)
        }, 100);
      }}
    >
      <FaCog style={{ cursor: 'pointer' }}/>
      {optionsMenuOpen && (
        <div className="user-menu">
          <div
            className="user-menu-item"
            onClick={() => {
              navigate("/settings");
              setOptionsMenuOpen(false);
            }}
          >
            <FaClock style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Daemon
          </div>
          <div
            className="user-menu-item"
            onClick={() => {
              navigate("/disk_management");
              setOptionsMenuOpen(false);
            }}
          >
            <FaSave style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Disk management
          </div>
          <div
            className="user-menu-item"
            onClick={() => {
              navigate("/water_level");
              setOptionsMenuOpen(false);
            }}
          >
            <FaWater style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Water level
          </div>
          <div
            className="user-menu-item"
            onClick={() => {
              navigate("/callback_url");
              setOptionsMenuOpen(false);
            }}
          >
            <FaCloudUploadAlt style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            LiveORC API
          </div>
          <div
            className="user-menu-item"
            onClick={() => {
              navigate("/updates");
              setOptionsMenuOpen(false);
            }}
          >
            <FaTools style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Updates
          </div>
        </div>
      )}
    </div>

  )
}
