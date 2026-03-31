import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getCourses, createCourse, type CourseItem } from "../services/content";
import { apiGet } from "../services/api";

type GroupedCourses = Record<string, CourseItem[]>;

function CourseSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-line skeleton-line--short" />
      <div
        className="skeleton skeleton-line skeleton-line--title"
        style={{ marginTop: "var(--space-3)" }}
      />
      <div
        className="skeleton skeleton-line skeleton-line--medium"
        style={{ marginTop: "var(--space-2)" }}
      />
    </div>
  );
}

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

  const grades = [...new Set(courses.map((c) => c.grade))].sort(
    (a, b) => a - b
  );

  const filtered = selectedGrade
    ? courses.filter((c) => c.grade === selectedGrade)
    : courses;

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
      // created is CourseItem — safe to spread into CourseItem[]
      setCourses((prev) => [...prev, created]);
      setShowNewCourse(false);
      setNewSubjectId("");
      setNewGrade("");
      setNewTitle("");
      setNewDesc("");
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create course."
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    

        {/* Page header */}
        <div className="section-header">
          <div>
            <h2 className="section-header__title">Curriculum Management</h2>
            <p className="section-header__subtitle">
              Shared curriculum — edits here apply to all students across Punjab
            </p>
          </div>
          <button
            className="btn btn--primary"
            onClick={() => setShowNewCourse(true)}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Course
          </button>
        </div>

        {error && <div className="alert alert--error">{error}</div>}

        {/* Grade filter pills */}
        {!loading && grades.length > 0 && (
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              flexWrap: "wrap",
              marginBottom: "var(--space-6)",
            }}
          >
            <button
              className="badge"
              style={{
                cursor: "pointer",
                border: "1px solid var(--border-medium)",
                background:
                  selectedGrade === null
                    ? "var(--saffron-glow)"
                    : "transparent",
                color:
                  selectedGrade === null
                    ? "var(--saffron)"
                    : "var(--ink-muted)",
                padding: "var(--space-1) var(--space-3)",
              }}
              onClick={() => setSelectedGrade(null)}
            >
              All Grades
            </button>
            {grades.map((grade) => (
              <button
                key={grade}
                className="badge"
                style={{
                  cursor: "pointer",
                  border: "1px solid var(--border-medium)",
                  background:
                    selectedGrade === grade
                      ? "var(--saffron-glow)"
                      : "transparent",
                  color:
                    selectedGrade === grade
                      ? "var(--saffron)"
                      : "var(--ink-muted)",
                  padding: "var(--space-1) var(--space-3)",
                }}
                onClick={() => setSelectedGrade(grade)}
              >
                Class {grade}
              </button>
            ))}
          </div>
        )}

        {/* Stats row */}
        {!loading && (
          <div className="stat-grid" style={{ marginBottom: "var(--space-8)" }}>
            <div className="card">
              <div className="card__label">Total Courses</div>
              <div className="card__value">{courses.length}</div>
            </div>
            <div className="card">
              <div className="card__label">Grades Covered</div>
              <div className="card__value">{grades.length}</div>
            </div>
            <div className="card">
              <div className="card__label">Subjects</div>
              <div className="card__value">
                {new Set(courses.map((c) => c.subject__name)).size}
              </div>
            </div>
            <div className="card">
              <div className="card__label">Shown</div>
              <div className="card__value">{filtered.length}</div>
            </div>
          </div>
        )}

        {/* Course grid */}
        {loading ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "var(--space-4)",
            }}
          >
            {Array.from({ length: 12 }).map((_, i) => (
              <CourseSkeleton key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">📚</div>
            <h3 className="empty-state__title">No courses yet</h3>
            <p className="empty-state__message">
              Run{" "}
              <code
                style={{
                  background: "var(--bg-elevated)",
                  padding: "2px 6px",
                  borderRadius: 4,
                }}
              >
                python manage.py seed_content
              </code>{" "}
              to populate sample curriculum, or create a course manually.
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-8)",
            }}
          >
            {Object.entries(grouped)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([subjectName, subjectCourses]) => (
                <div key={subjectName}>
                  <h3
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--text-base)",
                      fontWeight: 600,
                      color: "var(--ink-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      marginBottom: "var(--space-4)",
                    }}
                  >
                    {subjectName}
                  </h3>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fill, minmax(240px, 1fr))",
                      gap: "var(--space-3)",
                    }}
                  >
                    {subjectCourses
                      .sort((a, b) => a.grade - b.grade)
                      .map((course, i) => (
                        <div
                          key={course.id}
                          className="card page-enter"
                          style={{ animationDelay: `${i * 30}ms` }}
                        >
                          {/* Card header */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "flex-start",
                              marginBottom: "var(--space-2)",
                            }}
                          >
                            <span className="badge badge--info">
                              Class {course.grade}
                            </span>
                            {course.is_core && (
                              <span
                                style={{
                                  fontSize: "var(--text-xs)",
                                  color: "var(--success)",
                                }}
                              >
                                Core
                              </span>
                            )}
                          </div>

                          {/* Course title */}
                          <div
                            className="card__title"
                            style={{ fontSize: "var(--text-base)" }}
                          >
                            {course.title}
                          </div>

                          {/* Description */}
                          {course.description && (
                            <p
                              className="card__description"
                              style={{
                                marginTop: "var(--space-2)",
                                fontSize: "var(--text-xs)",
                              }}
                            >
                              {course.description.length > 80
                                ? course.description.slice(0, 80) + "…"
                                : course.description}
                            </p>
                          )}

                          {/* Action buttons */}
                          <div
                            style={{
                              marginTop: "var(--space-3)",
                              display: "flex",
                              gap: "var(--space-2)",
                            }}
                          >
                            <button
                              className="btn btn--ghost"
                              style={{
                                fontSize: "var(--text-xs)",
                                padding: "var(--space-1) var(--space-3)",
                                color: "var(--saffron)",
                                border: "1px solid var(--border-light)",
                              }}
                              onClick={() =>
                                navigate(
                                  `/admin/content/courses/${course.id}/lessons`
                                )
                              }
                            >
                              Lessons →
                            </button>
                            <button
                              className="btn btn--ghost"
                              style={{
                                fontSize: "var(--text-xs)",
                                padding: "var(--space-1) var(--space-3)",
                                color: "var(--warning)",
                                border: "1px solid var(--border-light)",
                              }}
                              onClick={() =>
                                navigate(
                                  `/admin/content/courses/${course.id}/assessments`
                                )
                              }
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
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.7)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: "var(--z-modal)",
              padding: "var(--space-4)",
            }}
          >
            <div
              className="card page-enter"
              style={{ width: "100%", maxWidth: 480 }}
            >
              <div
                className="section-header"
                style={{ marginBottom: "var(--space-5)" }}
              >
                <h2 className="section-header__title">New Course</h2>
                <button
                  className="btn btn--ghost"
                  onClick={() => {
                    setShowNewCourse(false);
                    setCreateError(null);
                  }}
                >
                  ✕
                </button>
              </div>

              {createError && (
                <div className="alert alert--error">{createError}</div>
              )}

              <div className="form-group">
                <label className="form-label">Subject *</label>
                <select
                  className="form-input"
                  value={newSubjectId}
                  onChange={(e) => setNewSubjectId(Number(e.target.value))}
                >
                  <option value="">Select subject…</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Grade *</label>
                <select
                  className="form-input"
                  value={newGrade}
                  onChange={(e) => setNewGrade(Number(e.target.value))}
                >
                  <option value="">Select grade…</option>
                  {[6, 7, 8, 9, 10].map((g) => (
                    <option key={g} value={g}>
                      Class {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Title *</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="e.g. Mathematics — Class 8"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Optional description"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              <div style={{ display: "flex", gap: "var(--space-3)" }}>
                <button
                  className="btn btn--primary"
                  disabled={creating}
                  onClick={() => void handleCreateCourse()}
                >
                  {creating ? (
                    <>
                      <span className="btn__spinner" aria-hidden="true" />{" "}
                      Creating…
                    </>
                  ) : (
                    "Create Course"
                  )}
                </button>
                <button
                  className="btn btn--secondary"
                  onClick={() => {
                    setShowNewCourse(false);
                    setCreateError(null);
                  }}
                  disabled={creating}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}