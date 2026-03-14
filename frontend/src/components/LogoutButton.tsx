import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";
import { useState } from "react";

export default function LogoutButton() {
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);

    try {
      await apiPost("/accounts/logout/", {});
    } catch (err) {
      // Backend logout failure should not block client-side logout.
      // Session will expire naturally via SESSION_COOKIE_AGE.
      console.warn("[LogoutButton] Backend logout failed:", err);
    } finally {
      // Always redirect — do not call auth.refresh() since we are
      // leaving the app entirely. The AuthContext will reset on
      // next mount when the user returns to /login.
      setIsLoggingOut(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      className="logout-btn"
      aria-label="Log out of GyanGrit"
    >
      {isLoggingOut ? (
        <>
          <span className="logout-btn__spinner" aria-hidden="true" />
          Logging out
        </>
      ) : (
        <>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Logout
        </>
      )}
    </button>
  );
}