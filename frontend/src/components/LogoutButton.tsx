import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api"; // use apiPost for logout (POST request)
import { useAuth } from "../auth/AuthContext";

export default function LogoutButton() {
  const navigate = useNavigate();
  const auth = useAuth();

  const handleLogout = async () => {
    try {
      // Call backend logout (POST /accounts/logout/)
      await apiPost("/accounts/logout/", {});

      // Force clear auth state
      auth.refresh(); // This resets state to unauthenticated

      // Immediately redirect to login
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
      // Still redirect even if API fails (session might already be dead)
      auth.refresh();
      navigate("/login", { replace: true });
    }
  };

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "8px 16px",
        background: "#dc3545",
        color: "white",
        border: "none",
        borderRadius: 4,
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}