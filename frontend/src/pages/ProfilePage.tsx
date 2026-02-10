import { useAuth } from "../auth/AuthContext";
import LogoutButton from "../components/LogoutButton";

export default function ProfilePage() {
  const auth = useAuth();

  if (auth.loading) {
    return <p>Loading profile…</p>;
  }

  return (
    <div style={{ maxWidth: 500, margin: "40px auto" }}>
      <h1>My Profile</h1>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          padding: 16,
          marginTop: 16,
        }}
      >
        <p>
          <strong>Username:</strong>{" "}
          {auth.username ?? "—"}
        </p>

        <p>
          <strong>Role:</strong> {auth.role}
        </p>

        <p>
          <strong>Authenticated:</strong>{" "}
          {auth.authenticated ? "Yes" : "No"}
        </p>
      </div>

      <div style={{ marginTop: 24 }}>
        <LogoutButton />
      </div>
    </div>
  );
}
