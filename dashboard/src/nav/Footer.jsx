import React, { useState, useEffect } from 'react';

import './Footer.css'
import orcLogo from '/orc_favicon.svg'


const Footer = ({apiStatus}) => {
  const [serverTime, setServerTime] = useState('--:--:--');
  const [clientTime, setClientTime] = useState('--:--:--');
  const [offsetMs, setOffsetMs] = useState(0);
  const [formatterServer, setFormatterServer] = useState(null);
  const [formatterClient, setFormatterClient] = useState(null);

  // Initialize offset and formatter on mount
  useEffect(() => {
    const t0 = Date.now();
    const serverTimeEpoch = apiStatus?.server_timeinfo?.epoch_seconds * 1000;

  //   const offsetClient = new Date().getTimezoneOffset() * -60 * 1000; // Client offset in ms (positive if ahead of UTC)

    const offsetServerClient = t0 - serverTimeEpoch; // Difference between server and client offsets
  // // Convert to seconds (flip sign to match server convention: positive = ahead of UTC)
    setOffsetMs(offsetServerClient || 0);

    const fmt = new Intl.DateTimeFormat(navigator.language, {
      timeZone: apiStatus?.server_timeinfo?.timezone || 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
      timezoneDisplay: 'short',
      hour12: false
    });
    setFormatterServer(fmt);
  const fmtClient = new Intl.DateTimeFormat(navigator.language, {
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
    timezoneDisplay: 'short',
    hour12: false
  });
  setFormatterClient(fmtClient);
  }, [apiStatus?.server_timeinfo]);

  // Update clock every second
  useEffect(() => {
    if (!formatterServer) return;

    const renderClock = () => {
      const serverNow = new Date(Date.now() + offsetMs);
      setServerTime(formatterServer.format(serverNow));
      setClientTime(formatterClient.format(new Date()));
    };

    renderClock();
    const interval = setInterval(renderClock, 1000);
    return () => clearInterval(interval);
  }, [offsetMs, formatterServer]);

  return (
    <footer className="footer">
      <div className="footer-content">
        <p style={{left: "0px"}}>
        <img src={orcLogo} alt="ORC Logo" width="20" className="footer-logo"/>
          {' '}
        <p>ORC-OS {apiStatus?.release} v{apiStatus.version} © {new Date().getFullYear()}
          <a className="dark-link" href="https://rainbowsensing.com"> https://rainbowsensing.com</a>
        </p>
        </p>
      </div>
      <div className="footer-content" style={{fontFamily: "monospace", fontSize: "0.8rem", position: "absolute", right: "10px", bottom: "5px",textAlign: "right"}}>
        <div>Device time: {serverTime}</div>
        <div>Client time: {clientTime}</div>
        </div>

    </footer>


  );
};

export default Footer;
