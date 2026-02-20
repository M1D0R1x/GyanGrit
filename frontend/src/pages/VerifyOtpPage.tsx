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
  role: "STUDENT" | "TEACHER" | "OFFICIAL" | "ADMIN";
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<VerifyOtpResponse>(
        "/accounts/verify-otp/",
        { username, otp }
      );

      await auth.refresh();

      if (response.role === "TEACHER") {
        navigate("/teacher", { replace: true });
      } else if (response.role === "OFFICIAL") {
        navigate("/official", { replace: true });
      } else if (response.role === "ADMIN") {
        navigate("/admin-panel", { replace: true });
      } else {
        navigate("/", { replace: true });
      }

    } catch {
      setError("Invalid OTP");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h2>Verify OTP</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Verifying…" : "Verify"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}