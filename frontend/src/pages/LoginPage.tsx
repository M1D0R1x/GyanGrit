import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";

type LoginApiResponse =
  | { otp_required: true }
  | {
      otp_required: false;
      id: number;
      username: string;
      role: "STUDENT" | "TEACHER" | "PRINCIPAL" | "OFFICIAL" | "ADMIN";
    };

export default function LoginPage() {
  const navigate = useNavigate();
  const auth = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await apiPost<LoginApiResponse>("/accounts/login/", {
        username,
        password,
      });

      if (response.otp_required) {
        navigate("/verify-otp", { state: { username }, replace: true });
        return;
      }

      // Success → refresh auth and redirect
      await auth.refresh();

      switch (response.role) {
        case "STUDENT":
          navigate("/dashboard", { replace: true });
          break;
        case "TEACHER":
          navigate("/teacher", { replace: true });
          break;
        case "PRINCIPAL":
        case "OFFICIAL":
          navigate("/official", { replace: true });
          break;
        case "ADMIN":
          navigate("/admin-panel", { replace: true });
          break;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

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
            style={{ width: "100%", padding: 10 }}
          />
        </div>
        <div style={{ marginBottom: 16 }}>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: "100%", padding: 10 }}
          />
        </div>

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
            fontSize: "1.1rem",
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>

      <p style={{ textAlign: "center", marginTop: 20 }}>
        Don't have an account?{" "}
        <button
          onClick={() => navigate("/register")}
          style={{ color: "#007bff", background: "none", border: "none", textDecoration: "underline" }}
        >
          Register here
        </button>
      </p>

      {error && <p style={{ color: "red", marginTop: 16, textAlign: "center" }}>{error}</p>}
    </div>
  );
}