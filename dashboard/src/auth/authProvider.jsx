
import { createContext, useState, useEffect } from "react";
import { authApi } from "../api/authApi.jsx";

export const AuthContext = createContext({user: null, login: () => {}, logout: () => {}});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);

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
    }
  };

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
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
