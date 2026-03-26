import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { apiPost } from "../services/api";

type Props = {
  onLogout?: () => void;
};

export default function LogoutButton({ onLogout }: Props) {
  const navigate = useNavigate();
  const auth     = useAuth();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await apiPost("/accounts/logout/", {});
    } catch {
      // proceed regardless — server session may already be cleared
    } finally {
      setLoading(false);
      onLogout?.();
      // refresh() will call /accounts/me/ → { authenticated: false }
      // which clears the user from AuthContext state
      await auth.refresh();
      navigate("/login", { replace: true });
    }
  };

  return (
    <button
      className="logout-btn"
      onClick={handleLogout}
      disabled={loading}
      style={{ width: "100%", justifyContent: "flex-start" }}
    >
      {loading ? (
        <span className="btn__spinner logout-btn__spinner" aria-hidden="true" />
      ) : (
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
      )}
      {loading ? "Signing out…" : "Sign out"}
    </button>
  );
}