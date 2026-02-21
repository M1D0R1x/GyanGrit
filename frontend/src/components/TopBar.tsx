import { useAuth } from "../auth/AuthContext";
import LogoutButton from "./LogoutButton";

export default function TopBar({ title }: { title: string }) {
  const auth = useAuth();

  if (auth.loading) {
    return <div>Loading...</div>;
  }

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 32,
        paddingBottom: 16,
        borderBottom: "1px solid #eee",
        background: "#fff",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <h1 style={{ margin: 0, fontSize: "1.8rem" }}>{title}</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {auth.authenticated && auth.username ? (
          <span style={{ fontWeight: 500 }}>
            Logged in as <strong>{auth.username}</strong>
          </span>
        ) : (
          <span>Not logged in</span>
        )}
        {auth.authenticated && <LogoutButton />}
      </div>
    </div>
  );
}