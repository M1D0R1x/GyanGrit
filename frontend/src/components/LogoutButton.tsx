import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import { useState } from "react";

export default function LogoutButton() {
  const navigate = useNavigate();
  const auth = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      // Step 1: Call backend logout first
      await apiPost("/accounts/logout/", {});

      // Step 2: Clear frontend state
      auth.refresh();

      // Step 3: Redirect immediately
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout API failed:", err);
      // Even if API fails, we still clear and redirect
      auth.refresh();
      navigate("/login", { replace: true });
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoggingOut}
      style={{
        padding: "10px 20px",
        background: isLoggingOut ? "#6c757d" : "#dc3545",
        color: "white",
        border: "none",
        borderRadius: 6,
        cursor: isLoggingOut ? "not-allowed" : "pointer",
        fontSize: "1rem",
        minWidth: "110px",
      }}
    >
      {isLoggingOut ? "Logging out..." : "Logout"}
    </button>
  );
}