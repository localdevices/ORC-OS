import reactLogo from './assets/react.svg'
import orcLogo from '/orc_favicon.svg'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import './App.css'
import Navbar from './nav/Navbar';
import Home from './views/home';
import DeviceForm from './views/deviceForm';
import api from './api'

const App = () => {
    return (
        <Router>
            <div>
                {/* Navbar appears everywhere */}
                <Navbar />
                {/* Define the route structure */}
                <Routes>
                    <Route path="*" element={<div>Snap!! 404 Page Not Found</div>} />
                    <Route path="/" element={<Home />} />
                    <Route path="/device_form" element={<DeviceForm />} />
                </Routes>
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
