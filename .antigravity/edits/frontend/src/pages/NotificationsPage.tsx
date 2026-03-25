import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import {
  getNotificationHistory,
  getSentHistory,
  sendNotification,
  markRead,
  type AppNotification,
  type Broadcast,
} from "../services/notifications";

const NotificationCard: React.FC<{ n: AppNotification; onClick: () => void }> = ({ n, onClick }) => {
  const isSystem = n.sender === "System";
  return (
    <div className="glass-card page-enter" onClick={onClick} style={{ padding: 'var(--space-4) var(--space-6)', marginBottom: 'var(--space-3)', borderLeft: n.is_read ? '2px solid transparent' : '2px solid var(--brand-primary)', opacity: n.is_read ? 0.7 : 1, cursor: 'pointer' }}>
       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
          <span style={{ fontSize: '10px', fontWeight: 900, color: isSystem ? 'var(--role-teacher)' : 'var(--role-student)' }}>{isSystem ? "SYSTEM ALERT" : "FROM: " + n.sender.toUpperCase()}</span>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{new Date(n.created_at).toLocaleDateString()}</span>
       </div>
       <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>{n.subject}</div>
       <div style={{ fontSize: '12px', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
    </div>
  );
};

const NotificationsPage: React.FC = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState<"inbox" | "history">("inbox");
  const [notifs, setNotifs] = useState<AppNotification[]>([]);
  const [sent, setSent] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);

  const isStaff = user?.role && ["TEACHER", "PRINCIPAL", "OFFICIAL", "ADMIN"].includes(user.role);

  useEffect(() => {
    setLoading(true);
    if (tab === "inbox") {
      getNotificationHistory({ page_size: 20 }).then(res => setNotifs(res.results)).finally(() => setLoading(false));
    } else {
      getSentHistory({ page_size: 20 }).then(res => setSent(res.results)).finally(() => setLoading(false));
    }
  }, [tab]);

  if (loading) return <div className="page-shell"><TopBar /><main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="btn__spinner" /></main></div>;

  return (
    <div className="page-shell">
      <TopBar title="Broadcast Hub" />
      <main className="page-content page-enter has-bottom-nav" style={{ maxWidth: '600px', margin: '0 auto', padding: 'var(--space-10) var(--space-6)' }}>
        
        <header style={{ marginBottom: 'var(--space-10)', textAlign: 'center' }}>
           <h1 className="text-gradient" style={{ fontSize: 'var(--text-4xl)', marginBottom: 'var(--space-4)' }}>Broadcasts.</h1>
           <div style={{ display: 'flex', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', padding: '4px', maxWidth: '300px', margin: '0 auto' }}>
              <button onClick={() => setTab("inbox")} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: tab === "inbox" ? 'var(--brand-primary)' : 'transparent', color: tab === "inbox" ? '#000' : 'var(--text-muted)', fontSize: '10px', fontWeight: 900, border: 'none' }}>INBOX</button>
              {isStaff && <button onClick={() => setTab("history")} style={{ flex: 1, padding: '8px', borderRadius: '4px', background: tab === "history" ? 'var(--brand-primary)' : 'transparent', color: tab === "history" ? '#000' : 'var(--text-muted)', fontSize: '10px', fontWeight: 900, border: 'none' }}>SENT LEDGER</button>}
           </div>
        </header>

        <div>
           {tab === "inbox" ? (
             notifs.map((n, i) => <NotificationCard key={i} n={n} onClick={() => markRead(n.id)} />)
           ) : (
             sent.map((s, i) => (
               <div key={i} className="glass-card" style={{ padding: 'var(--space-4) var(--space-6)', marginBottom: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
                     <span style={{ fontSize: '10px', fontWeight: 900, color: 'var(--role-principal)' }}>AUDIENCE: {s.audience_label.toUpperCase()}</span>
                     <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{new Date(s.sent_at).toLocaleDateString()}</span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 800, color: 'var(--text-primary)' }}>{s.subject}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>RECIPTIENTS: {s.recipient_count}</div>
               </div>
             ))
           )}
        </div>

      </main>
      <BottomNav />
    </div>
  );
};

export default NotificationsPage;
