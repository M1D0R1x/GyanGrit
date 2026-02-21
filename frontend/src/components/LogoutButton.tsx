import { useNavigate } from "react-router-dom";
import { apiLogout } from "../services/api";
import { useAuth } from "../auth/AuthContext";

export default function LogoutButton() {
  const navigate = useNavigate();
  const auth = useAuth();

  const handleLogout = async () => {
    try {
      await apiLogout();
      await auth.refresh(); // Reset auth state
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("Logout failed:", err);
      // Still redirect even if API fails
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