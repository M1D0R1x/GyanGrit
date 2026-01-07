import { useState } from "react";
import { apiPost } from "../services/api";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("STUDENT");
  const [msg, setMsg] = useState("");

  async function register() {
    await apiPost("/accounts/register/", {
      username,
      password,
      role,
    });
    setMsg("User created. You can login now.");
  }

  return (
    <div>
      <h2>Register (Dev Only)</h2>

      <input onChange={(e) => setUsername(e.target.value)} />
      <input type="password" onChange={(e) => setPassword(e.target.value)} />

      <select onChange={(e) => setRole(e.target.value)}>
        <option value="STUDENT">STUDENT</option>
        <option value="TEACHER">TEACHER</option>
        <option value="OFFICIAL">OFFICIAL</option>
        <option value="ADMIN">ADMIN</option>
      </select>

      <button onClick={register}>Register</button>
      {msg && <p>{msg}</p>}
    </div>
  );
}
