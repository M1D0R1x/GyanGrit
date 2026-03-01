import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";

type OtpLocationState = {
  username: string;
};

type VerifyOtpResponse = {
  success: true;
  id: number;
  username: string;
  role: "STUDENT" | "TEACHER" | "PRINCIPAL" | "OFFICIAL" | "ADMIN";
};

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const state = location.state as OtpLocationState | undefined;
  const username = state?.username;

  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!username) {
    return <p>Invalid access. Please login again.</p>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<VerifyOtpResponse>(
        "/accounts/verify-otp/",
        { username, otp }
      );

      await auth.refresh();

      switch (response.role) {
        case "STUDENT":
          navigate("/dashboard", { replace: true });
          break;
        case "TEACHER":
          navigate("/teacher", { replace: true });
          break;
        case "PRINCIPAL":
          navigate("/official", { replace: true });
          break;
        case "OFFICIAL":
          navigate("/official", { replace: true });
          break;
        case "ADMIN":
          navigate("/admin-panel", { replace: true });
          break;
        default:
          navigate("/login", { replace: true });
      }
    } catch (err: unknown) {
      setError("Invalid OTP");
      console.error("OTP verification failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h2>Verify OTP</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
          style={{ width: "100%", padding: 8, marginBottom: 16 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "10px",
            background: loading ? "#ccc" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: 4,
          }}
        >
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}
    </div>
  );
}