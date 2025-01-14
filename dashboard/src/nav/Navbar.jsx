import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';

const Navbar = () => {
    const [isOpen, setIsOpen] = useState(false); // track if navbar is open / closed
    const handleToggle = () => {
      setIsOpen(!isOpen); // Toggles the `isOpen` state
    };
    const handleClose = () => {
      setIsOpen(false); // Closes the navbar when called
    };
    return (
            <nav className='navbar navbar-dark bg-primary'>
                <div className='container-fluid'>
                    <a className='navbar-brand' href="#">
                        <img src="./public/orc_favicon.svg" alt="ORC Logo" width="30" height="30" className="d-inline-block align-text-top"/>
                    {' '} NodeORC
                    </a>
                    <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                        <span className="navbar-toggler-icon"></span>
                    </button>
                    <div className="collapse navbar-collapse" id="navbarNav">
                        <ul className="navbar-nav">
                            <li className="nav-item">
                                <NavLink
                                    className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                                    to="/">
                                Home
                                </NavLink>
                            </li>
                            <li className="nav-item">
                                <NavLink
                                    className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                                    to="/device">
                                    Device information
                                </NavLink>
                            </li>
                            <li className="nav-item">
                                <NavLink
                                    className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                                    to="/disk_management">
                                    Disk management
                                </NavLink>
                            </li>
                            <li className="nav-item">
                                <NavLink
                                    className={({ isActive }) => isActive ? "nav-link active" : "nav-link"}
                                    to="/camera_aim">
                                    Camera aiming
                                </NavLink>
                            </li>
                        </ul>
                    </div>

                </div>
            </nav>

    );
};

export default Navbar;