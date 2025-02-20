import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import './App.css'
import { MessageProvider } from './messageContext';
import Navbar from './nav/Navbar';
import Footer from './nav/Footer';
import Home from './views/home';
import Device from './views/device';
import Settings from './views/settings';
import DiskManagement from './views/diskManagement'
import WaterLevel from './views/waterLevel'
import CameraAim from './views/cameraAim'
import Calibration from './views/calibration'
import CallbackUrl from "./views/callbackUrl.jsx";
import ListVideo from "./views/listVideo.jsx";

const App = () => {

    return (
        <MessageProvider>
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
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/disk_management" element={<DiskManagement />} />
                    <Route path="/water_level" element={<WaterLevel />} />
                    <Route path="/camera_aim" element={<CameraAim />} />
                    <Route path="/callback_url" element={<CallbackUrl />} />
                    <Route path="/calibration" element={<Calibration />} />
                    <Route path="/video" element={<ListVideo />} />

                </Routes>
                </div>
                <Footer />
            </div>
        </Router>
        </MessageProvider>
    )
}

export default App
