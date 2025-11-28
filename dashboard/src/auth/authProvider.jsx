
import { createContext, useState, useEffect } from "react";
import { authApi } from "../api/authApi.jsx";
import api from "../api/api.js";

export const AuthContext = createContext({user: null, login: () => {}, logout: () => {}});

// Check if session cookie is available and valid (e.g. after page refresh)
const checkValidate = async () => {
  try {
    const response = await authApi.validate(); // check if session cookie is valid
    return response.data; // Assume successful response contains the user or relevant session data
  } catch (error) {
    console.error("Session validation failed", error);
    return null;
  }
};


export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    // Check session when the app loads
    const validateSession = async () => {
      const session = await checkValidate();
      if (session) {
        // session validated
        setUser("orc_client"); // Update user state based on session
      } else {
        setUser(null);
      }
      setInitializing(false);
    };
    validateSession();
  }, []);

  const login = async ( password ) => {
    try {
      await authApi.login(password);
      setUser("orc_client");  // we have only one user, so set to constant
    } catch (error) {
      console.error("Login failed:", error);
      throw new Error("Invalid password");
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
      setUser(null);
    }
  };

  const setNewPassword = async ( password ) => {
    try {
      await authApi.setPassword(password);
    } catch (error) {
      console.error("Setting password failed:", error);
      throw new Error("Problem setting password");
    }
  };

  const passwordAvailable = async () => {
    try {
      const response = await authApi.passwordAvailable();
      return response.data;
    } catch (error) {
      console.error("Could not check for password availability:", error);
    }
  }
  // Set up Axios interceptor for handling 401
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // revalidate before clearing user
          try {
            const session = await checkValidate();
            if (!session) {
              setUser(null);
              console.error("Session expired, logging out.");
            }
          } catch {
            setUser(null);
            console.error("Session validation failed, logging out.");
          }
        }
        return Promise.reject(error);
      }
    );

    // Cleanup the interceptor on unmount
    return () => {
      api.interceptors.response.eject(interceptor);
    };
  }, [setUser]);

  // useEffect (() => {
  //   ( async () => {
  //     try {
  //       await authApi.refresh();
  //       setUser("orc_client");
  //
  //     } catch {
  //       setUser(null);
  //     }
  //   })();
  // }, []);

  return (
    <AuthContext.Provider value={{ user, initializing, setUser, login, logout, passwordAvailable, setNewPassword }}>
      {children}
    </AuthContext.Provider>
  )
}
