import { useAuth } from "../auth/AuthContext";
import LogoutButton from "./LogoutButton";

export default function TopBar({ title }: { title: string }) {
  const auth = useAuth();

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 32,
        paddingBottom: 16,
        borderBottom: "1px solid #eee",
      }}
    >
      <h1>{title}</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {auth.username && (
          <span>
            Logged in as <strong>{auth.username}</strong>
          </span>
        )}
        <LogoutButton />
      </div>
    </div>
  );
}