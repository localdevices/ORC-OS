import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';

import './App.css'
import { MessageProvider } from './messageContext';
import Navbar from './nav/Navbar';
import Footer from './nav/Footer';
import Login from './views/login';
import ProtectedRoute from "./views/protectedRoute.jsx";
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
import api from './api/api.js';
import orcLogo from '/orc_favicon.svg'

// list of valid routes, used to hide Navbar and Footer when not available
const routeTemplates = [
  "/",
  "/login",
  "/device",
  "/updates",
  "/settings",
  "/disk_management",
  "/water_level",
  "/callback_url",
  "/camera_aim",
  "/calibration",
  "/video",
  "/video_config/<videoId>",
  "/recipe",
  "/cross_section",
];
// Match current path against route templates
const matchRoute = (path) => {
  // main page always has header/footer
  if (path === "/") return true;

  // remove trailing slashes if they are present
  const normalizedPath = path.replace(/\/+$/, "")

  // Check against static routes directly
  if (routeTemplates.includes(normalizedPath)) return true;

  // Match dynamic template routes
  return routeTemplates.some((template) => {
    if (template.includes("<")) {
      // Convert template to regex: Replace <...> with \d+ (matching any number)
      const regexPattern = `^${template.replace(/<[^>]+>/g, "(\\d+)")}$`;

      const regex = new RegExp(regexPattern); // Correct RegExp construction
      return regex.test(normalizedPath); // Check if the path matches the generated regex
    }
    return false; // If no template, it's a static path
  });
};


// Helper component to conditionally render Navbar and Footer
const Layout = ({ children }) => {
  const location = useLocation();

  const isInvalidRoute = !matchRoute(location.pathname);

  // Hide Navbar and Footer on login or 404 routes
  const hideLayout = location.pathname === "/login" || isInvalidRoute;

  return (
    <div className="app-container">
      {!hideLayout && <Navbar />}
      <div className="main-content">{children}</div>
      {!hideLayout && <Footer />}
    </div>
  );
};

const App = () => {
    const [isLoading, setIsLoading] = useState(true); // Spinner state
    const [apiStatus, setApiStatus] = useState(null); // Error state
    const [requiresRestart, setRequiresRestart] = useState(false); // track if device needs restart

  // check for API availability
    useEffect(() => {
        let interval;
        const checkApiAvailability = async () => {
            try {
                const response = await api.get("/"); // check the root page
                if (response.status === 200) {
                  setIsLoading(false); // API is available, stop showing spinner
                } else {
                  console.log(response)

                  // throw new Error("Invalid API response: " + response.status);
                }
            } catch (error) {
              if (error.response && error.response.status === 401) {
                console.log("Navigate to login")
                setIsLoading(false);
              } else {
                console.log(error)
                setApiStatus("ORC-OS back end seems offline. Waiting for ORC-OS backend to start...");
                setIsLoading(true);
                setRequiresRestart(false);  // as app is starting, restart is never required at this point
              }
            }
        };
        // Start checking every 5 seconds
        checkApiAvailability(); // Check immediately on mount
        interval = setInterval(checkApiAvailability, 500000);

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
          <Layout>
            <Routes>
              <Route path="*" element={<div>Snap!! 404 Page Not Found</div>} />
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                   <Home />
                 </ProtectedRoute>
              } />
              <Route path="/device" element={
                <ProtectedRoute>
                  <Device />
                </ProtectedRoute>
              } />
              <Route path="/updates" element={<Updates />} />
              <Route path="/settings" element={<Settings
                setRequiresRestart={setRequiresRestart}
              />} />
              <Route path="/disk_management" element={<DiskManagement
                setRequiresRestart={setRequiresRestart}
              />} />
              <Route path="/water_level" element={<WaterLevel
                setRequiresRestart={setRequiresRestart}
              />} />
              <Route path="/callback_url" element={<CallbackUrl
                setRequiresRestart={setRequiresRestart}
              />} />
              <Route path="/camera_aim" element={<CameraAim />} />
              <Route path="/calibration" element={<Calibration />} />
              <Route path="/video" element={<ListVideo />} />
              <Route path="/video_config/:videoId" element={<VideoConfig />} />
              <Route path="/recipe" element={<ListRecipe />} />
              <Route path="/cross_section" element={<ListCrossSection />} />
            </Routes>
          </Layout>
        </Router>
        </MessageProvider>
    )
}

export default App
