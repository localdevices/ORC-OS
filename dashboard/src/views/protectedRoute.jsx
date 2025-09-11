// ProtectedRoute.js
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.jsx";

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();  // use stored token where available
  return user ? children : <Navigate to="/login" />;
};

export default ProtectedRoute;
