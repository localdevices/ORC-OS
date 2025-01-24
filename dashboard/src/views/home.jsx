import React, {useState, useEffect} from 'react';
import { FaTimes } from 'react-icons/fa';
import reactLogo from '/react.svg'
import orcLogo from '/orc_favicon.svg'
import api from "../api"

const Home = () => {
  const [count, setCount] = useState(0)
  const [showMessage, setShowMessage] = useState(true);

  return (
    <>
    {showMessage && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#0e6bb1',
          color: '#fff',
          padding: '10px',
          borderBottom: '1px solid #ccc'
        }}>
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <strong style={{ marginRight: '8px', fontSize: '18px' }}>!</strong>
            <span>Welcome to NodeORC configuration!</span>
          </span>
          <FaTimes
            onClick={() => setShowMessage(false)} // Hide the message on clicking
          />

        </div>
      )}


      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={orcLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>NodeORC configuration</h1>

      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}


export default Home;