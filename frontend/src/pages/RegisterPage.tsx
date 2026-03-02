import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"STUDENT" | "TEACHER" | "PRINCIPAL" | "OFFICIAL" | "ADMIN">("STUDENT");
  const [joinCode, setJoinCode] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!username || !password || !joinCode) {
      setError("Username, password and join_code are required");
      return;
    }

    setLoading(true);
    setError("");
    setMsg("");

    try {
      await apiPost("/accounts/register/", {
        username,
        password,
        role,
        join_code: joinCode,
      });

      setMsg("✅ User created successfully! You can now login.");
      // Optional: auto redirect to login after success
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      const errorMsg = err?.message || "Registration failed";
      setError(errorMsg);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "20px" }}>
      <h2>Register (Dev Only)</h2>

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

      <div style={{ marginBottom: 12 }}>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as any)}
          style={{ width: "100%", padding: 10 }}
        >
          <option value="STUDENT">STUDENT</option>
          <option value="TEACHER">TEACHER</option>
          <option value="PRINCIPAL">PRINCIPAL</option>
          <option value="OFFICIAL">OFFICIAL</option>
          <option value="ADMIN">ADMIN</option>
        </select>
      </div>

      <div style={{ marginBottom: 16 }}>
        <input
          placeholder="Join Code (required)"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
          style={{ width: "100%", padding: 10 }}
        />
        <small style={{ color: "#666" }}>
          Get this from teacher/principal roster or admin
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
        {loading ? "Creating User..." : "Register"}
      </button>

      {msg && <p style={{ color: "green", marginTop: 16 }}>{msg}</p>}
      {error && <p style={{ color: "red", marginTop: 16 }}>{error}</p>}

      <p style={{ marginTop: 20, textAlign: "center" }}>
        Already have account?{" "}
        <button
          onClick={() => navigate("/login")}
          style={{ color: "#007bff", background: "none", border: "none" }}
        >
          Go to Login
        </button>
      </p>
    </div>
  );
}