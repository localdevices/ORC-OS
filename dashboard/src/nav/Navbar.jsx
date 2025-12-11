import { useState } from 'react';
import PropTypes from 'prop-types';
import {
  FaUser,
  FaSync,
  FaSpinner,
  FaCheck,
  FaTimes,
  FaSignOutAlt,
  FaKey,
  FaHome,
  FaVideo,
  FaFilm,
  FaFileAlt,
  FaProjectDiagram,
  FaUtensils,
} from 'react-icons/fa'; // Import User, Cog and Restart icons
import { FaMicrochip } from 'react-icons/fa6';
import { NavLink } from 'react-router-dom';
import './Navbar.css'
import orcLogo from '/orc_favicon.svg'
import MessageBox from "../messageBox.jsx";
import {OptionsMenu} from "./optionsMenu.jsx";
import {PasswordChangeModal} from "./passwordChangeModal.jsx";
import api from "../api/api.js";
import { useAuth } from "../auth/useAuth.jsx";

const Navbar = ({requiresRestart, setRequiresRestart, setIsLoading, videoRunState}) => {

  const [isOpen, setIsOpen] = useState(false); // track if the navbar is open / closed
  const { logout } = useAuth();
  // states for handling password changes
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // delay on closure of the User menu to prevent closing when hovering over the menu items
  let userMenuCloseTimer = null;

  const handleToggle = (openState, setOpenState) => {
    setOpenState(!openState); // Toggles the `isOpen` state
  };
  const handleClose = () => {
    setIsOpen(false); // Closes the navbar when called
  };

  const handleUserButtonClick = async () => {
    await logout();
  };

  const handleRestartClick = () => {
    setIsLoading(true);
    setRequiresRestart(false);
    // shutdown the API. Systemd or Docker process should restart the API
    api.post("/updates/shutdown").then(r => {return r})
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 1:
        return
      case 3:
        return <span><FaSpinner style={{color: "white", animation: "spin 1s linear infinite"}}/> </span>// Spinner for processing
      case 4:
        return <span><FaCheck style={{
          color: "green",
          filter: "drop-shadow(0px 0px 1px white)",
        }}/> </span>; // Success
      case 5:
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
      case 5:
        return <span><FaSpinner style={{color: "white", animation: "spin 1s linear infinite"}}/> </span>// Spinner for syncing
      case 2:
        return <span><FaCheck style={{
          color: "cadetblue",
          filter: "drop-shadow(0px 0px 1px white)",
        }}/> </span>; // Error

      case 4:
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
              <span style={{ fontWeight: 'bold', position: 'absolute', overflow: 'hidden', zIndex: 0, width: '700px', whiteSpace: 'nowrap', display: 'inline-block', textOverflow: 'ellipsis'}}>
                        {getStatusIcon(videoRunState.status)} {getSyncStatusIcon(videoRunState.sync_status)} {videoRunState.video_file} - {videoRunState.message}
                      </span>
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
            <OptionsMenu/>
            <div
              className="user-menu-wrapper"
              onMouseEnter={() => {
                if (userMenuCloseTimer) {
                  clearTimeout(userMenuCloseTimer);
                  userMenuCloseTimer = null;
                }
                setUserMenuOpen(true)}
              }
              onMouseLeave={() => {
                userMenuCloseTimer = setTimeout(() => {
                  setUserMenuOpen(false)
                }, 100);
              }}
            >
              <FaUser style={{ cursor: 'pointer' }}/>
              {userMenuOpen && (
                <div className="user-menu">
                  <div
                    className="user-menu-item"
                    onClick={() => {
                      setShowPasswordModal(true);
                      setUserMenuOpen(false);
                    }}
                  >
                    <FaKey style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Change password
                  </div>
                  <div
                    className="user-menu-item"
                    onClick={handleUserButtonClick}
                  >
                    <FaSignOutAlt style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                    Logout
                  </div>
                </div>
              )}
            </div>
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
          <li className="sidebar-brand" style={{fontSize: "25px"}}>Menu</li>
          <hr/>
          <li>
            <NavLink
              className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
              to="/" onClick={handleClose}>
              <FaHome style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Home
            </NavLink>
          </li>

          <li>
            <NavLink
              className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
              to="/device" onClick={handleClose}>
              <FaMicrochip style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Device information
            </NavLink>
          </li>
          <li>
            <NavLink
              className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
              to="/log" onClick={handleClose}>
              <FaFileAlt style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Log file
            </NavLink>
          </li>
          <li>
            <NavLink
              className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
              to="/camera_aim" onClick={handleClose}>
              <FaVideo style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Aim your camera
            </NavLink>
          </li>
          <li>
            <NavLink
              className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
              to="/recipe" onClick={handleClose}>
              <FaUtensils style={{ marginRight: '8px', verticalAlign: 'middle' }} />

              Recipes
            </NavLink>
          </li>
          <li>
            <NavLink
              className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
              to="/cross_section" onClick={handleClose}>
              <FaProjectDiagram style={{ marginRight: '8px', verticalAlign: 'middle' }} />

              Cross sections
            </NavLink>
          </li>
          <li>
            <NavLink
              className={({ isActive }) => isActive ? "sidebar-link active" : "sidebar-link"}
              to="/video" onClick={handleClose}>
              <FaFilm style={{ marginRight: '8px', verticalAlign: 'middle' }} />
              Videos
            </NavLink>
          </li>
        </ul>
      </div>
      {isOpen && <div className="sidebar-overlay" onClick={() => handleToggle(isOpen, setIsOpen)}></div>}
      {showPasswordModal && (
        <>
          <PasswordChangeModal setShowModal={setShowPasswordModal} />
        </>
      )}
    </>

  );
};

Navbar.propTypes = {
  requiresRestart: PropTypes.bool.isRequired,
  setRequiresRestart: PropTypes.func.isRequired,
  setIsLoading: PropTypes.func.isRequired,
  videoRunState: PropTypes.shape({
    video_file: PropTypes.string,
    status: PropTypes.number,
    sync_status: PropTypes.number,
    message: PropTypes.string
  })
};

export default Navbar;
