// Login page for access to dashboard and back end
import { useState, useEffect } from "react";
import { useWindowSize } from "react-use";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.jsx";
import Confetti from 'react-confetti'
import orcLogo from "/orc_favicon.svg";

const Login = () => {
  const [password, setPassword] = useState("");
  const [passAvailable, setPassAvailable] = useState(true);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login, passwordAvailable, setNewPassword } = useAuth();
  const { width, height } = useWindowSize();
  // upon entering the page, check if a password exists in the database
  useEffect(()  => {
    async function fetchPasswordAvailable() {
      const res = await passwordAvailable();
      setPassAvailable(res);
    }
    fetchPasswordAvailable();
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!passAvailable) {
      console.log("Setting password first")
      await setNewPassword(password);
      setPassAvailable(true);
    }
    try {
      await login(password);
      navigate("/"); // Redirect after successful login
    } catch (error) {
      console.error("Login failed:", error);
      setError("Invalid password");
    }
  };

  return (
    <div>
    {!passAvailable && <Confetti width={width} height={height} />}
    <div className="spinner-container" style={{overflow: "hidden"}}>
      <div>
        <a href="https://openrivercam.org" target="_blank">
          <img src={orcLogo} className="logo" alt="ORC logo" style={{"height": "300px"}} />
        </a>
      </div>
      <div>
        {passAvailable ? (
      <p>Please enter your password to proceed</p>) : (
        <div>
          <p>Congratulations! This is your first use of ORC-OS! Please set a password now.</p>
        </div>)
        }
      </div>
      <form onSubmit={handleLogin}>
        <input
          type="password"
          placeholder="Enter password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn" type="submit">Login</button>
        {error && <p style={{ color: "red" }}>{error}</p>} {/* Display login error */}
      </form>
    </div>
    </div>
  );
};
export default Login;
