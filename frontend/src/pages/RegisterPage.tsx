import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !password || !joinCode) {
      setError("Username, password and join code are required");
      return;
    }

    setLoading(true);
    setError("");
    setMsg("");

    try {
      await apiPost("/accounts/register/", {
        username,
        password,
        join_code: joinCode,
        // No role sent → backend will take it from join_code
      });

      setMsg("✅ Registration successful! You can now login.");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err: unknown) {
      // Fixed: no more "any" → clean TypeScript
      const message =
        err instanceof Error
          ? err.message
          : "Registration failed. Check your join code.";

      setError(message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "20px" }}>
      <h2>Register</h2>
      <p style={{ opacity: 0.7 }}>
        Role is automatically set by the join code
      </p>

      <div style={{ marginBottom: 12 }}>
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Join Code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          style={{ width: "100%", padding: 10 }}
        />
        <small style={{ color: "#666", display: "block", marginTop: 4 }}>
          Paste the code you received from teacher / principal / roster
        </small>
      </div>

      <button
        onClick={handleRegister}
        disabled={loading}
        style={{
          width: "100%",
          padding: "12px",
          background: loading ? "#ccc" : "#28a745",
          color: "white",
          border: "none",
          borderRadius: 4,
          fontSize: "1rem",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Creating Account..." : "Register"}
      </button>

      {msg && <p style={{ color: "green", marginTop: 16, fontWeight: "bold" }}>{msg}</p>}
      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

      <p style={{ marginTop: 24, textAlign: "center" }}>
        Already have an account?{" "}
        <button
          onClick={() => navigate("/login")}
          style={{
            color: "#007bff",
            background: "none",
            border: "none",
            textDecoration: "underline",
          }}
        >
          Login here
        </button>
      </p>
    </div>
  );
}