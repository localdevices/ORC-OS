import { useContext } from "react";
import { AuthContext } from "./authProvider.jsx";

export const useAuth = () => useContext(AuthContext);
