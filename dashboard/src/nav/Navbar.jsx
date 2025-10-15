import { useState } from 'react';
import {FaUser, FaCog, FaSync, FaSpinner, FaCheck, FaTimes} from 'react-icons/fa'; // Import User, Cog and Restart icons
import { NavLink } from 'react-router-dom';
import './Navbar.css'
import orcLogo from '/orc_favicon.svg'
import MessageBox from "../messageBox.jsx";
import api from "../api/api.js";
import { useAuth } from "../auth/useAuth.jsx";

const Navbar = ({requiresRestart, setRequiresRestart, setIsLoading, videoRunState}) => {
    const [isOpen, setIsOpen] = useState(false); // track if navbar is open / closed
    const [settingsOpen, setSettingsOpen] = useState(false); // track if settings menu is open
    const { logout } = useAuth();
    const handleToggle = (openState, setOpenState) => {
      setOpenState(!openState); // Toggles the `isOpen` state
    };
    const handleClose = () => {
      setIsOpen(false); // Closes the navbar when called
      setSettingsOpen(false);
    };

    const handleUserButtonClick = async () => {
        await logout();
    };

    const handleSettingsClick = () => {
        setSettingsOpen(!settingsOpen);
    };

    const handleRestartClick = () => {
      setIsLoading(true);
      setRequiresRestart(false);
      // shutdown the API. Systemd or Docker process should restart the API
      api.post("/updates/shutdown")
    }

  const getStatusIcon = (status) => {
    switch (status) {
      case 1:
        return
      case 2:
        return <span><FaSpinner style={{color: "white", animation: "spin 1s linear infinite"}}/> </span>// Spinner for processing
      case 3:
        return <span><FaCheck style={{
          color: "green",
          filter: "drop-shadow(0px 0px 1px white)",
        }}/> </span>; // Success
      case 9:
        return <span><FaTimes style={{
          color: "red",
          filter: "drop-shadow(0px 0px 1px white)",
        }}/> error</span>; // Error
      default:
        return
    }
  };
  const getSyncStatusIcon = (status) => {
    switch (status) {
      case 1:
        return
      case 2:
        return <span><FaSpinner style={{color: "white", animation: "spin 1s linear infinite"}}/> </span>// Spinner for syncing
      case 3:
        return <span><FaCheck style={{color: "cadetblue"}}/> </span>; // Error
      case 9:
        return <span><FaTimes style={{
          color: "red",
          filter: "drop-shadow(0px 0px 1px white)",
        }}/> </span>; // Error
      default:
        return
    }
  };

  return (
        <>
            <nav className='navbar navbar-dark'>
                <div className='container-fluid'>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation" onClick={() => handleToggle(isOpen, setIsOpen)}>
                        <span className="navbar-toggler-icon"></span>
                    </button>
                  <div className="navbar-message" style={{ marginRight: 'auto', marginLeft: '10px' }}>
                    {videoRunState?.video_file !== "" && (
                      <span style={{ fontWeight: 'bold', position: 'absolute', overflow: 'hidden', zIndex: 0, width: '700px', whiteSpace: 'nowrap', display: 'inline-block', textOverflow: 'ellipsis'}}>{getStatusIcon(videoRunState.status)} {getSyncStatusIcon(videoRunState.sync_status)} {videoRunState.video_file} - {videoRunState.message}</span>
                    )}
                  </div>
                    <div className="navbar-right">
                        <MessageBox/>
                        <FaSync

                          className={requiresRestart ? "pulsating-icon" : ""}
                          style={{
                            color: requiresRestart ? "orange" : "grey",
                            strokeWidth: requiresRestart ? "30px" : "5px",
                            cursor: 'pointer'
                          }}
                          title={requiresRestart ? "Restart required" : "No restart required"}
                          disabled={!requiresRestart}
                          onClick={handleRestartClick}
                        />
                        <FaCog onClick={handleSettingsClick}/>
                        <FaUser onClick={handleUserButtonClick}/>
                    </div>
                </div>
            </nav>
            <div className={`sidebar ${isOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <a className='navbar-brand' href="#">
                        <img src={orcLogo} alt="ORC Logo" width="30" height="30" className="d-inline-block align-text-top"/>
                    {' '} ORC-OS
                    </a>
                    <button className="close-button" onClick={() => {handleToggle(isOpen, setIsOpen);}}>
                        &times;
                    </button>
                </div>
                <ul className="sidebar-nav">
                    <hr/>
                    <li className="sidebar-brand" style={{fontSize: "25px"}}>Menu</li>
                    <hr/>

                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/device" onClick={handleClose}>
                            Device information
                        </NavLink>
                    </li>
                    <li>
                      <NavLink
                        className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                        to="/log" onClick={handleClose}>
                        Log file
                      </NavLink>
                    </li>
                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/camera_aim" onClick={handleClose}>
                            Aim your camera in the field
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                            className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                            to="/" onClick={handleClose}>
                        Home
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/recipe" onClick={handleClose}>
                            Recipes
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/cross_section" onClick={handleClose}>
                            Cross sections
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/video" onClick={handleClose}>
                            Videos
                        </NavLink>
                    </li>
                </ul>
            </div>
            {isOpen && <div className="sidebar-overlay" onClick={() => handleToggle(isOpen, setIsOpen)}></div>}
            {settingsOpen && <div className="sidebar-overlay" onClick={() => handleToggle(settingsOpen, setSettingsOpen)}></div>}
            <div className={`sidebar right ${settingsOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <FaCog style={{margin: '1rem'}}></FaCog>
                    <h3>Settings</h3>
                    <button className="close-button" onClick={handleSettingsClick}>&times;</button>
                </div>
                <ul className="sidebar-nav right">
                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/settings" onClick={handleClose}>
                            Daemon settings
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/disk_management" onClick={handleClose}>
                            Disk management settings
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/water_level" onClick={handleClose}>
                            Water level settings
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/callback_url" onClick={handleClose}>
                            Set up LiveORC link
                        </NavLink>
                    </li>
                    <li>
                        <NavLink
                          className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
                          to="/updates" onClick={handleClose}>
                            Updates
                        </NavLink>
                    </li>
                    <hr/>
                </ul>
            </div>
            {settingsOpen && <div className="settings-overlay" onClick={handleSettingsClick}></div>}
        </>

    );
};

export default Navbar;
