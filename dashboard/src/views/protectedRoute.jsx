// ProtectedRoute.js
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/useAuth.jsx";
import PropTypes from "prop-types";

const ProtectedRoute = ({ children }) => {
  const { user, initializing } = useAuth();  // use stored token where available
  // While validating session, render nothing or a small placeholder to prevent immediate redirect to login
  if (initializing) {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
};
export default ProtectedRoute;
