import { useState } from 'react';
import {FaUser, FaCog, FaSync} from 'react-icons/fa'; // Import User, Cog and Restart icons
import { NavLink } from 'react-router-dom';
import './Navbar.css'
import orcLogo from '/orc_favicon.svg'
import MessageBox from "../messageBox.jsx";
import api from "../api.js";


const Navbar = ({requiresRestart, setRequiresRestart, setIsLoading}) => {
    const [isOpen, setIsOpen] = useState(false); // track if navbar is open / closed
    const [settingsOpen, setSettingsOpen] = useState(false); // track if settings menu is open
    const handleToggle = (openState, setOpenState) => {
      setOpenState(!openState); // Toggles the `isOpen` state
    };
    const handleClose = () => {
      setIsOpen(false); // Closes the navbar when called
      setSettingsOpen(false);
    };

    const handleUserButtonClick = () => {
        // Add your login logic here
        alert('User login functionality to be implemented.');
    };

    const handleSettingsClick = () => {
        setSettingsOpen(!settingsOpen);
    };

    const handleRestartClick = () => {
      console.log("Restart button clicked");
      setIsLoading(true);
      setRequiresRestart(false);
      // shutdown the API. Systemd or Docker process should restart the API
      api.post("/updates/shutdown")
    }

    return (
        <>
            <nav className='navbar navbar-dark'>
                <div className='container-fluid'>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation" onClick={() => handleToggle(isOpen, setIsOpen)}>
                        <span className="navbar-toggler-icon"></span>
                    </button>
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
                    {' '} NodeORC
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
                    <hr/>
                    <li className="sidebar-brand" style={{fontSize: "25px"}}>Settings</li>
                    <hr/>

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
