import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { createWebSocketConnection } from "./api.js";

import './App.css'
import { MessageProvider } from './messageContext';
import Navbar from './nav/Navbar';
import Footer from './nav/Footer';
import Home from './views/home';
import Device from './views/device';
import Updates from './views/updates';
import Settings from './views/settings';
import DiskManagement from './views/diskManagement'
import WaterLevel from './views/waterLevel'
import CameraAim from './views/cameraAim'
import Calibration from './views/calibration'
import CallbackUrl from "./views/callbackUrl.jsx";
import ListVideo from "./views/listVideo.jsx";
import VideoConfig from "./views/videoConfig.jsx";
import ListRecipe from "./views/listRecipe.jsx";
import ListCrossSection from "./views/listCrossSection.jsx";
import api from './api';
import orcLogo from '/orc_favicon.svg'

const App = () => {
    const [isLoading, setIsLoading] = useState(true); // Spinner state
    const [apiStatus, setApiStatus] = useState(null); // Error state

    // check for API availability
    useEffect(() => {
        let interval;
        const checkApiAvailability = async () => {
            try {
                await api.get(""); // check the root page
                setIsLoading(false); // API is available, stop showing spinner
            } catch (error) {
                setApiStatus("Waiting for ORC-OS backend to start...");
            }
        };
        // Start checking every 5 seconds
        checkApiAvailability(); // Check immediately on mount
        interval = setInterval(checkApiAvailability, 5000);

        // Cleanup to prevent memory leaks
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return (
          <div className="spinner-container">
              <div>
                  <a href="https://openrivercam.org" target="_blank">
                      <img src={orcLogo} className="logo" alt="ORC logo" style={{"height": "300px"}} />
                  </a>
              </div>
              <div className="spinner"></div>
              <p>{apiStatus || "Application is starting up, please wait..."}</p>
          </div>
        );
    }

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
                    <Route path="/updates" element={<Updates />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/disk_management" element={<DiskManagement />} />
                    <Route path="/water_level" element={<WaterLevel />} />
                    <Route path="/camera_aim" element={<CameraAim />} />
                    <Route path="/callback_url" element={<CallbackUrl />} />
                    <Route path="/calibration" element={<Calibration />} />
                    <Route path="/video" element={<ListVideo />} />
                    <Route path="/video_config/:videoId" element={<VideoConfig />} />
                    <Route path="/recipe" element={<ListRecipe />} />
                    <Route path="/cross_section" element={<ListCrossSection />} />

                </Routes>
                </div>
                <Footer />
            </div>
        </Router>
        </MessageProvider>
    )
}

export default App
