import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function RoleBasedRedirect() {
  const auth = useAuth();

  if (auth.loading) {
    return <p>Loading...</p>;
  }

  // If not authenticated → login
  if (!auth.authenticated) {
    return <Navigate to="/login" replace />;
  }

  switch (auth.role) {
    case "STUDENT":
      return <Navigate to="/dashboard" replace />;
    case "TEACHER":
      return <Navigate to="/teacher" replace />;
    case "PRINCIPAL":
      return <Navigate to="/official" replace />; // Redirecting to /official; add dedicated route if needed
    case "OFFICIAL":
      return <Navigate to="/official" replace />;
    case "ADMIN":
      return <Navigate to="/admin-panel" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}