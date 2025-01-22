import React, { useState } from 'react';
import { FaWifi } from 'react-icons/fa'; // Import WiFi icon
import { NavLink } from 'react-router-dom';
import './Navbar.css'

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false); // track if navbar is open / closed
    const handleToggle = () => {
      setIsOpen(!isOpen); // Toggles the `isOpen` state
    };
    const handleClose = () => {
      setIsOpen(false); // Closes the navbar when called
    };
    const handleWiFiButtonClick = () => {
        // Add your WiFi connection logic here
        alert('Connect to WiFi functionality to be implemented.');
    };

    return (
        <>
            <nav className='navbar navbar-dark bg-primary'>
                <div className='container-fluid'>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation" onClick={handleToggle}>
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <a className='navbar-brand' href="#">
                        <img src="./public/orc_favicon.svg" alt="ORC Logo" width="30" height="30" className="d-inline-block align-text-top"/>
                    {' '} NodeORC
                    </a>
                    <div className="navbar-right">
                        <FaWifi className="wifi-button" onClick={handleWiFiButtonClick}
                        />
                    </div>

                </div>
            </nav>
            <div className={`sidebar ${isOpen ? 'open' : ''}`}>
                <button className="close-sidebar" onClick={handleToggle}>
                    &times;
                </button>

                <ul className="sidebar-nav">
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
                            to="/device" onClick={handleClose}>
                            Device information
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
                            to="/camera_aim" onClick={handleClose}>
                            Aim your camera in the field
                        </NavLink>
                    </li>
                </ul>
            </div>
            {isOpen && <div className="sidebar-overlay" onClick={handleToggle}></div>}

        </>

    );
};

export default Navbar;