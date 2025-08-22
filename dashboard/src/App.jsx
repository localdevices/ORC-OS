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
const Layout = ({ children, requiresRestart, setRequiresRestart, setIsLoading}) => {
  const location = useLocation();

  const isInvalidRoute = !matchRoute(location.pathname);

  // Hide Navbar and Footer on login or 404 routes
  const hideLayout = location.pathname === "/login" || isInvalidRoute;

  return (
    <div className="app-container">
      {!hideLayout && <Navbar
        requiresRestart={requiresRestart}
        setRequiresRestart={setRequiresRestart}
        setIsLoading={setIsLoading}
      />}
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
                // navigate to login by setting loading to false. While user is null, the login page will always appear
                setIsLoading(false);
              } else {
                setApiStatus("ORC-OS back end seems offline. Waiting for ORC-OS backend to start...");
                setIsLoading(true);
                setRequiresRestart(false);  // as app is starting, restart is never required at this point
              }
            }
        };
        // Start checking every 5 seconds
        checkApiAvailability(); // Check immediately on mount
        interval = setInterval(checkApiAvailability, 10000);

        // Cleanup to prevent memory leaks
        return () => clearInterval(interval);
    }, []);

    if (isLoading) {
        return (
          <div className="app-container">
            <div className="spinner-container">
                <div>
                    <a href="https://openrivercam.org" target="_blank">
                        <img src={orcLogo} className="logo" alt="ORC logo" style={{"height": "300px"}} />
                    </a>
                </div>
                <div className="spinner"></div>
                <div>{apiStatus || "Application is starting up, please wait..."}</div>
            </div>
          </div>
        );
    }
    return (
        <MessageProvider>
          <Router>
            <Layout
              requiresRestart={requiresRestart}
              setRequiresRestart={setRequiresRestart}
              setIsLoading={setIsLoading}
            >
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
                <Route path="/updates" element={
                  <ProtectedRoute>
                    <Updates />
                  </ProtectedRoute>
                } />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings
                      setRequiresRestart={setRequiresRestart}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/disk_management" element={
                  <ProtectedRoute>
                  <DiskManagement
                    setRequiresRestart={setRequiresRestart}
                  />
                  </ProtectedRoute>
                } />
                <Route path="/water_level" element={
                  <ProtectedRoute>
                    <WaterLevel
                      setRequiresRestart={setRequiresRestart}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/callback_url" element={
                  <ProtectedRoute>
                    <CallbackUrl
                      setRequiresRestart={setRequiresRestart}
                    />
                  </ProtectedRoute>
                } />
                <Route path="/camera_aim" element={
                  <ProtectedRoute>
                    <CameraAim />
                  </ProtectedRoute>
                } />
                <Route path="/calibration" element={
                  <ProtectedRoute>
                    <Calibration />
                  </ProtectedRoute>
                } />
                <Route path="/video" element={
                  <ProtectedRoute>
                    <ListVideo />
                  </ProtectedRoute>
                } />
                <Route path="/video_config/:videoId" element={
                  <ProtectedRoute>
                    <VideoConfig />
                  </ProtectedRoute>
                } />
                <Route path="/recipe" element={
                  <ProtectedRoute>
                    <ListRecipe />
                  </ProtectedRoute>
                } />
                <Route path="/cross_section" element={
                  <ProtectedRoute>
                    <ListCrossSection />
                  </ProtectedRoute>
                } />
              </Routes>
            </Layout>
          </Router>
        </MessageProvider>
    )
}

export default App
