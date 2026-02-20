import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiPost } from "../services/api";
import { useAuth } from "../auth/AuthContext";

type LoginResponse = {
  id: number;
  username: string;
  role: "STUDENT" | "TEACHER" | "OFFICIAL" | "ADMIN";
};

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const auth = useAuth();

  const from =
    (location.state as { from?: string })?.from || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Login request
      const response = await apiPost<LoginResponse>(
        "/accounts/login/",
        { username, password }
      );

      // Refresh auth state (updates context)
      await auth.refresh();

      // Redirect based on role from response (not stale context)
      if (response.role === "TEACHER") {
        navigate("/teacher", { replace: true });
      } else if (response.role === "OFFICIAL") {
        navigate("/official", { replace: true });
      } else if (response.role === "ADMIN") {
        navigate("/admin-panel", { replace: true });
      } else {
        navigate(from, { replace: true });
      }

    } catch {
      setError("Invalid credentials");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h2>Login</h2>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Login"}
        </button>
      </form>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
