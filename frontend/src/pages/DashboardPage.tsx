import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type StudentSubject = {
  id: number;
  name: string;
  total_lessons: number;
  completed_lessons: number;
  progress: number;
};

function SubjectCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-line skeleton-line--title" />
      <div className="skeleton skeleton-line skeleton-line--medium" style={{ marginTop: "var(--space-4)" }} />
      <div className="skeleton skeleton-line skeleton-line--full" style={{ height: 6, marginTop: "var(--space-3)" }} />
      <div className="skeleton skeleton-line skeleton-line--short" style={{ marginTop: "var(--space-2)" }} />
    </div>
  );
}

function SubjectCard({ subject }: { subject: StudentSubject }) {
  const navigate = useNavigate();
  const progressColor =
    subject.progress >= 80 ? "var(--success)" :
    subject.progress >= 40 ? "var(--warning)" :
    "var(--brand-primary)";

  return (
    <div
      className="card card--clickable"
      // FIX: navigate to /courses filtered by this subject, not generic /courses
      onClick={() => navigate(`/courses?subject_id=${subject.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && navigate(`/courses?subject_id=${subject.id}`)}
      aria-label={`${subject.name} — ${subject.progress}% complete`}
    >
      <div className="card__label">Subject</div>
      <div className="card__title">{subject.name}</div>
      <p style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)", margin: "var(--space-2) 0" }}>
        {subject.completed_lessons} of {subject.total_lessons} lessons completed
      </p>
      <div className="progress-bar">
        <div
          className="progress-bar__fill"
          style={{ width: `${subject.progress}%`, background: progressColor }}
        />
      </div>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: "var(--space-1)",
      }}>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)" }}>Progress</span>
        <span style={{
          fontSize: "var(--text-sm)",
          fontWeight: 700,
          color: progressColor,
          fontFamily: "var(--font-display)",
        }}>
          {subject.progress}%
        </span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    apiGet<StudentSubject[]>("/academics/subjects/")
      .then((data) => setSubjects(data || []))
      .catch(() => setError("Failed to load dashboard. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page-shell">
      <TopBar title="Dashboard" />
      <main className="page-content page-enter">
        <div className="section-header">
          <div>
            <h2 className="section-header__title">Your Subjects</h2>
            <p className="section-header__subtitle">
              Track your progress across all enrolled subjects
            </p>
          </div>
        </div>

        {error && <div className="alert alert--error" role="alert">{error}</div>}

        {loading ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}>
            {Array.from({ length: 6 }).map((_, i) => <SubjectCardSkeleton key={i} />)}
          </div>
        ) : subjects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <h3 className="empty-state__title">No subjects yet</h3>
            <p className="empty-state__message">
              Your subjects will appear here once your teacher assigns them.
            </p>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "var(--space-4)",
          }}>
            {subjects.map((subject, i) => (
              <div key={subject.id} style={{ animationDelay: `${i * 60}ms` }} className="page-enter">
                <SubjectCard subject={subject} />
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}