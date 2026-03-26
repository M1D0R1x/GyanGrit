// RoleBasedRedirect.tsx — full file

import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

function AuthLoadingScreen() {
  return (
    <div className="auth-loading">
      <div className="auth-loading__logo">
        Gyan<span>Grit</span>
      </div>
      <div className="auth-loading__spinner" />
      <p className="auth-loading__text">Loading</p>
    </div>
  );
}

export default function RoleBasedRedirect() {
  const auth = useAuth();

  if (auth.loading) {
    return <AuthLoadingScreen />;
  }

  if (!auth.authenticated) {
    return <Navigate to="/login" replace />;
  }

  // Redirect to profile completion if profile is incomplete (first login)
  // Skip for ADMIN — they may not need profile fields
  if (auth.user && !auth.user.profile_complete && auth.user.role !== "ADMIN") {
    return <Navigate to="/complete-profile" replace />;
  }

  switch (auth.user?.role) {
    case "STUDENT":   return <Navigate to="/dashboard"   replace />;
    case "TEACHER":   return <Navigate to="/teacher"     replace />;
    case "PRINCIPAL": return <Navigate to="/principal"   replace />;
    case "OFFICIAL":  return <Navigate to="/official"    replace />;
    case "ADMIN":     return <Navigate to="/admin-panel" replace />;
    default:          return <Navigate to="/login"       replace />;
  }
}