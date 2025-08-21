// Login page for access to dashboard and back end
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.jsx";

const Login = () => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    console.log("Typed password: ", password)
    try {
      await login(password);
      navigate("/"); // Redirect after successful login
    } catch (error) {
      console.error("Login failed:", error);
      setError("Invalid password");
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button type="submit">Login</button>
      {error && <p style={{ color: "red" }}>{error}</p>} {/* Display login error */}
    </form>
  );
};
export default Login;
