import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { getCourses, createCourse, type CourseItem } from "../services/content";
import { apiGet } from "../services/api";

type GroupedCourses = Record<string, CourseItem[]>;

export default function AdminContentPage() {
  const navigate = useNavigate();

  const [courses, setCourses]   = useState<CourseItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);

  // New course modal state
  const [showNewCourse, setShowNewCourse] = useState(false);
  const [subjects, setSubjects]           = useState<{ id: number; name: string }[]>([]);
  const [newSubjectId, setNewSubjectId]   = useState<number | "">("");
  const [newGrade, setNewGrade]           = useState<number | "">("");
  const [newTitle, setNewTitle]           = useState("");
  const [newDesc, setNewDesc]             = useState("");
  const [creating, setCreating]           = useState(false);
  const [createError, setCreateError]     = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      getCourses(),
      apiGet<{ id: number; name: string }[]>("/academics/subjects/"),
    ])
      .then(([coursesData, subjectsData]) => {
        setCourses(coursesData);
        setSubjects(subjectsData);
      })
      .catch(() => setError("Failed to load data."))
      .finally(() => setLoading(false));
  }, []);

  const grades = [...new Set(courses.map((c) => c.grade))].sort((a, b) => a - b);

  const filtered = selectedGrade ? courses.filter((c) => c.grade === selectedGrade) : courses;

  const grouped: GroupedCourses = filtered.reduce((acc, course) => {
    const key = course.subject__name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {} as GroupedCourses);

  const handleCreateCourse = async () => {
    if (!newSubjectId || !newGrade || !newTitle.trim()) {
      setCreateError("Subject, grade, and title are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const created = await createCourse({
        subject_id: Number(newSubjectId),
        grade: Number(newGrade),
        title: newTitle.trim(),
        description: newDesc.trim(),
        is_core: true,
      });
      setCourses((prev) => [...prev, created]);
      setShowNewCourse(false);
      setNewSubjectId(""); setNewGrade(""); setNewTitle(""); setNewDesc("");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Failed to create course.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-shell">
      <TopBar title="Content" />
      <main className="page-content page-enter">

        {/* Header */}
        <div className="section-header animate-fade-up" style={{ marginBottom: "var(--space-6)" }}>
          <div>
            <h2 className="section-title">Curriculum Management</h2>
            <p className="section-subtitle">Shared curriculum — edits here apply to all students across Punjab</p>
          </div>
          <button className="btn--primary" onClick={() => setShowNewCourse(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            New Course
          </button>
        </div>

        {error && <div className="alert alert--error animate-fade-up">{error}</div>}

        {/* Grade filter pills */}
        {!loading && grades.length > 0 && (
          <div className="animate-fade-up" style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
            <button
              className="role-tag"
              style={{ cursor: "pointer", border: `1px solid ${selectedGrade === null ? "rgba(61,214,140,0.4)" : "var(--glass-border)"}`, background: selectedGrade === null ? "rgba(61,214,140,0.1)" : "transparent", color: selectedGrade === null ? "var(--role-student)" : "var(--text-muted)", padding: "4px 14px", borderRadius: "var(--radius-full)", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}
              onClick={() => setSelectedGrade(null)}
            >
              ALL GRADES
            </button>
            {grades.map((grade) => (
              <button
                key={grade}
                className="role-tag"
                style={{ cursor: "pointer", border: `1px solid ${selectedGrade === grade ? "rgba(61,214,140,0.4)" : "var(--glass-border)"}`, background: selectedGrade === grade ? "rgba(61,214,140,0.1)" : "transparent", color: selectedGrade === grade ? "var(--role-student)" : "var(--text-muted)", padding: "4px 14px", borderRadius: "var(--radius-full)", fontSize: 10, fontWeight: 800, letterSpacing: "0.06em" }}
                onClick={() => setSelectedGrade(grade)}
              >
                CLASS {grade}
              </button>
            ))}
          </div>
        )}

        {/* Stats row */}
        {!loading && (
          <div className="animate-fade-up" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-3)", marginBottom: "var(--space-8)" }}>
            {[
              { label: "Total Courses",   value: courses.length },
              { label: "Grades Covered",  value: grades.length },
              { label: "Subjects",        value: new Set(courses.map((c) => c.subject__name)).size },
              { label: "Shown",           value: filtered.length },
            ].map(({ label, value }) => (
              <div key={label} className="glass-card" style={{ textAlign: "center", padding: "var(--space-4)" }}>
                <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-2xl)", color: "var(--text-primary)", letterSpacing: "-0.03em" }}>{value}</div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "var(--text-muted)", marginTop: 4 }}>{label.toUpperCase()}</div>
              </div>
            ))}
          </div>
        )}

        {/* Course grid */}
        {loading ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="skeleton-box" style={{ height: 140, borderRadius: "var(--radius-lg)" }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card empty-well animate-fade-up">
            <span style={{ fontSize: 40, display: "block", marginBottom: "var(--space-4)", opacity: 0.3 }}>📚</span>
            <p style={{ fontWeight: 800, fontSize: "10px", letterSpacing: "0.1em" }}>NO COURSES YET</p>
            <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>
              Run <code style={{ background: "rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: 4 }}>python manage.py seed_content</code> to populate sample curriculum, or create a course manually.
            </span>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-8)" }}>
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([subjectName, subjectCourses]) => (
                <div key={subjectName}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize: 9, fontWeight: 800, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: "var(--space-4)" }}>
                    {subjectName}
                  </h3>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--space-3)" }}>
                    {subjectCourses.sort((a, b) => a.grade - b.grade).map((course, i) => (
                      <div key={course.id} className="glass-card animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "var(--space-2)" }}>
                          <span className="role-tag role-tag--student" style={{ fontSize: 9 }}>CLASS {course.grade}</span>
                          {course.is_core && <span style={{ fontSize: 9, fontWeight: 800, color: "var(--role-student)", letterSpacing: "0.04em" }}>CORE</span>}
                        </div>

                        <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "var(--text-sm)", color: "var(--text-primary)", marginBottom: "var(--space-2)", letterSpacing: "-0.01em" }}>
                          {course.title}
                        </div>

                        {course.description && (
                          <p style={{ fontSize: "var(--text-xs)", color: "var(--text-muted)", marginBottom: "var(--space-3)", lineHeight: 1.5 }}>
                            {course.description.length > 80 ? course.description.slice(0, 80) + "…" : course.description}
                          </p>
                        )}

                        <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-3)" }}>
                          <button
                            className="btn--ghost"
                            style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)", color: "var(--role-teacher)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--radius-sm)" }}
                            onClick={() => navigate(`/admin/content/courses/${course.id}/lessons`)}
                          >
                            Lessons →
                          </button>
                          <button
                            className="btn--ghost"
                            style={{ fontSize: "var(--text-xs)", padding: "var(--space-1) var(--space-3)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: "var(--radius-sm)" }}
                            onClick={() => navigate(`/admin/content/courses/${course.id}/assessments`)}
                          >
                            Assessment →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* New Course modal */}
        {showNewCourse && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, padding: "var(--space-4)", backdropFilter: "blur(8px)" }}>
            <div className="glass-card animate-fade-up" style={{ width: "100%", maxWidth: 480, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-5)" }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "var(--text-lg)", color: "var(--text-primary)", letterSpacing: "-0.02em" }}>New Course</h2>
                <button className="btn--ghost" onClick={() => { setShowNewCourse(false); setCreateError(null); }}>✕</button>
              </div>

              {createError && <div className="alert alert--error" style={{ marginBottom: "var(--space-4)" }}>{createError}</div>}

              <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
                <div>
                  <label className="form-label">Subject *</label>
                  <select className="obsidian-input" value={newSubjectId} onChange={(e) => setNewSubjectId(Number(e.target.value))}>
                    <option value="">Select subject…</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label">Grade *</label>
                  <select className="obsidian-input" value={newGrade} onChange={(e) => setNewGrade(Number(e.target.value))}>
                    <option value="">Select grade…</option>
                    {[6, 7, 8, 9, 10].map((g) => <option key={g} value={g}>Class {g}</option>)}
                  </select>
                </div>

                <div>
                  <label className="form-label">Title *</label>
                  <input className="obsidian-input" type="text" placeholder="e.g. Mathematics — Class 8" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                </div>

                <div>
                  <label className="form-label">Description</label>
                  <textarea className="obsidian-input" rows={3} placeholder="Optional description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} style={{ resize: "vertical" }} />
                </div>

                <div style={{ display: "flex", gap: "var(--space-3)" }}>
                  <button className="btn--primary" disabled={creating} onClick={() => void handleCreateCourse()} style={{ letterSpacing: "0.05em" }}>
                    {creating ? "Creating…" : "CREATE COURSE"}
                  </button>
                  <button className="btn--secondary" onClick={() => { setShowNewCourse(false); setCreateError(null); }} disabled={creating}>
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
