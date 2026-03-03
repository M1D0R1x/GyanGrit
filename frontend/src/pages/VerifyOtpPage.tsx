import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";

type OtpLocationState = { username: string };

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

  if (!username) return <p>Invalid access. Please login again.</p>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<VerifyOtpResponse>("/accounts/verify-otp/", { username, otp });

      await auth.refresh();

      switch (response.role) {
        case "STUDENT": navigate("/dashboard", { replace: true }); break;
        case "TEACHER": navigate("/teacher", { replace: true }); break;
        case "PRINCIPAL":
        case "OFFICIAL": navigate("/official", { replace: true }); break;
        case "ADMIN": navigate("/admin-panel", { replace: true }); break;
      }
    } catch (err: unknown) {
      setError("Invalid OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "20px" }}>
      <h2>Verify OTP</h2>
      <p style={{ opacity: 0.7 }}>Enter the 6-digit code sent to your account</p>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          required
          maxLength={6}
          style={{ width: "100%", padding: 12, fontSize: "1.2rem", textAlign: "center", marginBottom: 16 }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "12px",
            background: loading ? "#6c757d" : "#007bff",
            color: "white",
            border: "none",
            borderRadius: 6,
          }}
        >
          {loading ? "Verifying OTP..." : "Verify OTP"}
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: 16, textAlign: "center" }}>{error}</p>}
    </div>
  );
}