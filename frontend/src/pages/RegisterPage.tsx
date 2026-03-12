import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiPost } from "../services/api";

interface ValidateJoinCodeResponse {
  valid: boolean;
  role: string;
  institution?: string | null;
  section?: string | null;
  district?: string | null;
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const [detectedRole, setDetectedRole] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState("");

  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-validate join code when user stops typing
  useEffect(() => {
    if (joinCode.length < 8) {
      setDetectedRole(null);
      setValidationError("");
      return;
    }

    const timeout = setTimeout(async () => {
      setValidating(true);
      setValidationError("");

      try {
        const res = await apiPost<ValidateJoinCodeResponse>(
          "/accounts/validate-join-code/",
          { join_code: joinCode }
        );

        setDetectedRole(res.role);
        setValidationError("");
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Invalid or expired join code";
        setValidationError(msg);
        setDetectedRole(null);
      } finally {
        setValidating(false);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [joinCode]);

  const handleRegister = async () => {
    if (!username || !password || !joinCode) {
      setError("Username, password and join code are required");
      return;
    }

    if (!detectedRole) {
      setError("Please enter a valid join code first");
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
      });

      setMsg("✅ Registration successful! Redirecting to login...");
      setTimeout(() => navigate("/login"), 1800);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Registration failed. Check your join code.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "80px auto", padding: "20px" }}>
      <h2>Register</h2>
      <p style={{ opacity: 0.7 }}>
        Role is automatically locked by the join code
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

      <div style={{ marginBottom: 8 }}>
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

      {/* Validation Status */}
      {validating && <p style={{ color: "#666" }}>Validating join code...</p>}

      {detectedRole && (
        <p style={{ color: "#28a745", fontWeight: "bold", margin: "8px 0" }}>
          ✅ You will be registered as: <strong>{detectedRole}</strong>
        </p>
      )}

      {validationError && (
        <p style={{ color: "red", margin: "8px 0" }}>{validationError}</p>
      )}

      <button
        onClick={handleRegister}
        disabled={loading || !detectedRole || validating}
        style={{
          width: "100%",
          padding: "12px",
          background:
            loading || !detectedRole || validating ? "#ccc" : "#28a745",
          color: "white",
          border: "none",
          borderRadius: 4,
          fontSize: "1rem",
          cursor:
            loading || !detectedRole || validating ? "not-allowed" : "pointer",
          marginTop: 12,
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