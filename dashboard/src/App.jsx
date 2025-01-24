import reactLogo from '/react.svg'
import orcLogo from '/orc_favicon.svg'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import './App.css'
import Navbar from './nav/Navbar';
import Footer from './nav/Footer';
import Home from './views/home';
import Device from './views/device';
import DiskManagement from './views/diskManagement'
import WaterLevel from './views/waterLevel'
import CameraAim from './views/cameraAim'
import Calibration from './views/calibration'
import api from './api'

const App = () => {
    return (
        <Router>
            <div className="app-container">
                {/* Navbar appears everywhere */}
                <Navbar />
                {/* Define the route structure */}
                <div className="main-content">
                <Routes>
                    <Route path="*" element={<div>Snap!! 404 Page Not Found</div>} />
                    <Route path="/" element={<Home />} />
                    <Route path="/device" element={<Device />} />
                    <Route path="/disk_management" element={<DiskManagement />} />
                    <Route path="/water_level" element={<WaterLevel />} />
                    <Route path="/camera_aim" element={<CameraAim />} />
                    <Route path="/calibration" element={<Calibration />} />

                </Routes>
                </div>
                <Footer />
            </div>
        </Router>
    )
}

export default App
