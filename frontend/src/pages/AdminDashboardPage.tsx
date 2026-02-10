import { useEffect, useState } from "react";
import { apiGet } from "../services/api";

type UserRow = {
  id: number;
  username: string;
  role: "STUDENT" | "TEACHER" | "OFFICIAL" | "ADMIN";
  is_active: boolean;
};

export default function AdminDashboardPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<UserRow[]>("/accounts/users/")
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ padding: 24 }}>Loading admin dashboard…</p>;
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 24 }}>
      <h1>Admin Dashboard</h1>
      <p style={{ opacity: 0.7 }}>
        System-level user overview (read-only)
      </p>

      {/* Summary */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 16,
          marginTop: 24,
          marginBottom: 32,
        }}
      >
        <StatBox label="Total Users" value={users.length} />
        <StatBox
          label="Admins"
          value={users.filter((u) => u.role === "ADMIN").length}
        />
        <StatBox
          label="Officials"
          value={users.filter((u) => u.role === "OFFICIAL").length}
        />
        <StatBox
          label="Teachers"
          value={users.filter((u) => u.role === "TEACHER").length}
        />
        <StatBox
          label="Students"
          value={users.filter((u) => u.role === "STUDENT").length}
        />
      </div>

      {/* User table */}
      <h2>User List</h2>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 12,
        }}
      >
        <thead>
          <tr>
            <th style={th}>Username</th>
            <th style={th}>Role</th>
            <th style={th}>Active</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td style={td}>{u.username}</td>
              <td style={td}>{u.role}</td>
              <td style={td}>
                {u.is_active ? "✅ Active" : "❌ Disabled"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  padding: "8px",
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "8px",
};

function StatBox({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        border: "1px solid #ddd",
        borderRadius: 8,
        padding: 16,
        background: "#fafafa",
      }}
    >
      <div style={{ fontSize: 14, opacity: 0.6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: "bold" }}>{value}</div>
    </div>
  );
}
