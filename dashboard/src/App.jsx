import reactLogo from '/react.svg'
import orcLogo from '/orc_favicon.svg'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import './App.css'
import Navbar from './nav/Navbar';
import Footer from './nav/Footer';
import Home from './views/home';
import Device from './views/device';
import DiskManagement from './views/diskManagement'
import CameraAim from './views/cameraAim'
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
                    <Route path="/camera_aim" element={<CameraAim />} />
                </Routes>
                </div>
                <Footer />
            </div>
        </Router>
    )
}
//
// function App() {
//   const [count, setCount] = useState(0)
//
//   return (
//     <>
//       <div>
//         <a href="https://vite.dev" target="_blank">
//           <img src={orcLogo} className="logo" alt="Vite logo" />
//         </a>
//         <a href="https://react.dev" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <h1>NodeORC configuration</h1>
//       <div className="card">
//         <button onClick={() => setCount((count) => count + 1)}>
//           count is {count}
//         </button>
//         <p>
//           Edit <code>src/App.jsx</code> and save to test HMR
//         </p>
//       </div>
//       <p className="read-the-docs">
//         Click on the Vite and React logos to learn more
//       </p>
//     </>
//   )
// }

export default App
