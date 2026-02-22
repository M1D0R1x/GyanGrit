import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RoleBasedRedirect() {
  const auth = useAuth();

  // If not authenticated → login
  if (!auth.authenticated) {
    return <Navigate to="/login" replace />;
  }

  switch (auth.role) {
    case "STUDENT":
      return <Navigate to="/dashboard" replace />;
    case "TEACHER":
      return <Navigate to="/teacher" replace />;
    case "OFFICIAL":
      return <Navigate to="/official" replace />;
    case "ADMIN":
      return <Navigate to="/admin-panel" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}