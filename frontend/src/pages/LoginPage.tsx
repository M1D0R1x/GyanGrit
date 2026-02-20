import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";

type LoginApiResponse =
  | {
      otp_required: true;
      dev_console?: { username: string; otp: string }; // optional dev field
    }
  | {
      otp_required: false;
      id: number;
      username: string;
      role: "STUDENT" | "TEACHER" | "OFFICIAL" | "ADMIN";
      dev_console?: { username: string; otp: string }; // optional dev field
    };

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const from = (location.state as { from?: string })?.from || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<LoginApiResponse>("/accounts/login/", {
        username,
        password,
      });

      console.log("Login API response:", response); // ← Debug: check what actually comes back

      // OTP required branch
      if (response.otp_required) {
        console.log("OTP required → navigating to /verify-otp"); // ← Debug
        navigate("/verify-otp", {
          state: { username },
          replace: true,
        });
        return;
      }

      // Dev console leak (remove in production!)
      if ("dev_console" in response) {
        console.log("DEV LOGIN INFO:", response.dev_console);
      }

      // Successful password-only login (no OTP needed)
      await auth.refresh();

      if (response.role === "TEACHER") {
        navigate("/teacher", { replace: true });
      } else if (response.role === "OFFICIAL") {
        navigate("/official", { replace: true });
      } else if (response.role === "ADMIN") {
        navigate("/admin-panel", { replace: true });
      } else {
        // STUDENT or others
        navigate(from, { replace: true });
      }
    } catch (err: any) {
      console.error("Login failed:", err); // ← Debug: see real error
      setError(err.message || "Invalid credentials or server error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto", padding: "20px" }}>
      <h2>Login</h2>

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 16 }}>
          <input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 8 }}
          />
        </div>

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
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>

      {error && (
        <p style={{ color: "red", marginTop: 16, textAlign: "center" }}>
          {error}
        </p>
      )}
    </div>
  );
}