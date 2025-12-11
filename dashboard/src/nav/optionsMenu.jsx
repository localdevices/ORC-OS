import {FaSave, FaClock, FaCog, FaWater, FaCloudUploadAlt, FaTools} from "react-icons/fa";

import {useState} from "react";
import { useNavigate } from "react-router-dom";

export const OptionsMenu = () => {
  const [optionsMenuOpen, setOptionsMenuOpen] = useState(false);
  const navigate = useNavigate();
  // delay on closure of the User menu to prevent closing when hovering over the menu items
  let optionsMenuCloseTimer = null;

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
            onClick={() => {openSetting("/settings")}}
            onKeyDown={() => {openSetting("/settings")}}
            role="button"
          >
            <FaClock style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Daemon
          </div>
          <div
            className="user-menu-item"
            onClick={() => {openSetting("/disk_management")}}
            onKeyDown={() => {openSetting("/disk_management")}}
            role="button"
          >
            <FaSave style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Disk management
          </div>
          <div
            className="user-menu-item"
            onClick={() => {openSetting("/water_level")}}
            onKeyDown={() => {openSetting("/water_level")}}
            role="button"
          >
            <FaWater style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Water level
          </div>
          <div
            className="user-menu-item"
            onClick={() => {openSetting("/callback_url")}}
            onKeyDown={() => {openSetting("/callback_url")}}
            role="button"
          >
            <FaCloudUploadAlt style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            LiveORC API
          </div>
          <div
            className="user-menu-item"
            onClick={() => {openSetting("/updates")}}
            onKeyDown={() => {openSetting("/updates")}}
            role="button"
          >
            <FaTools style={{ marginRight: '8px', verticalAlign: 'middle' }} />
            Updates
          </div>
        </div>
      )}
    </div>

  )
}
