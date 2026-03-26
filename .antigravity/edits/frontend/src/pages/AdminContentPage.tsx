import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import TopBar from "../components/TopBar";
import { getCourses, createCourse, type CourseItem } from "../services/content";
import { apiGet } from "../services/api";
import { 
  Plus, 
  BookOpen, 
  Award, 
  ChevronRight, 
  Filter, 
  BarChart3, 
  Database,
  Search,
  BookMarked,
  X
} from 'lucide-react';
import './AdminContentPage.css';

type GroupedCourses = Record<string, CourseItem[]>;

const AdminContentPage: React.FC = () => {
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
    let cancelled = false;
    async function loadData() {
      try {
        const [c, s] = await Promise.all([
          getCourses(),
          apiGet<{ id: number; name: string }[]>("/academics/subjects/"),
        ]);
        if (!cancelled) {
          setCourses(c ?? []);
          setSubjects(s ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("TELEMETRY ERROR: Curriculum database unreachable.");
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { cancelled = true; };
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
      setCreateError("Subject, grade, and title are required for nodal creation.");
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
      setNewSubjectId("");
      setNewGrade("");
      setNewTitle("");
      setNewDesc("");
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : "Protocol Error: Failed to instantiate curriculum node.");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Content Terminal" />
        <main className="page-content">
          <div className="skeleton-stack animate-pulse-subtle">
             <div className="skeleton-box" style={{ height: '60px', marginBottom: '20px' }} />
             <div className="skeleton-box" style={{ height: '400px' }} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Curriculum Oversight" />
      <main className="page-content page-enter content-mgmt-layout">

        {/* Header Nexus */}
        <section className="content-header animate-fade-up">
           <div className="inst-info">
              <span className="inst-label">CENTRAL CURRICULUM MANAGEMENT</span>
              <h1 className="inst-name">ACADEMIC REPOSITORY</h1>
              <p className="hero-subtitle">Unified architecture for all state-wide educational content.</p>
           </div>
           <button className="btn--primary" onClick={() => setShowNewCourse(true)}>
              <Plus size={16} /> INSTANTIATE NEW COURSE
           </button>
        </section>

        {error && <div className="alert alert--error">{error}</div>}

        {/* Global Filter Stats */}
        <div className="stat-nexus-grid animate-fade-up" style={{ animationDelay: '50ms' }}>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label">CORE COURSES</span>
              <span className="stat-tile__val">{courses.length}</span>
           </div>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label">GRADE SPAN</span>
              <span className="stat-tile__val">{grades.length}</span>
           </div>
           <div className="glass-card stat-tile">
              <span className="stat-tile__label">SUBJECTS</span>
              <span className="stat-tile__val">{new Set(courses.map((c) => c.subject__name)).size}</span>
           </div>
           <div className="glass-card stat-tile" style={{ borderColor: 'var(--brand-primary)' }}>
              <span className="stat-tile__label">ACTIVE FILTER</span>
              <span className="stat-tile__val" style={{ color: 'var(--brand-primary)' }}>{filtered.length}</span>
           </div>
        </div>

        {/* Grade Navigation */}
        <div className="filter-pills animate-fade-up" style={{ animationDelay: '100ms' }}>
           <button className={`filter-pill ${selectedGrade === null ? 'active' : ''}`} onClick={() => setSelectedGrade(null)}>
              ALL PROTOCOLS
           </button>
           {grades.map(grade => (
             <button key={grade} className={`filter-pill ${selectedGrade === grade ? 'active' : ''}`} onClick={() => setSelectedGrade(grade)}>
                CLASS {grade}
             </button>
           ))}
        </div>

        {/* Curriculum Grid */}
        {filtered.length === 0 ? (
          <div className="empty-state animate-fade-up">
             <Database size={48} color="var(--text-dim)" />
             <h3 className="empty-state__title">REPOSITORY VOID</h3>
             <p className="empty-state__message">No curriculum nodes matching the current filter protocol.</p>
          </div>
        ) : (
          <div className="subject-group-stack">
             {Object.entries(grouped)
              .sort(([a],[b]) => a.localeCompare(b))
              .map(([subject, subjectCourses], idx) => (
                <section key={subject} className="subject-group animate-fade-up" style={{ animationDelay: `${idx * 100}ms` }}>
                   <div className="subject-title-nexus">
                      <BookMarked size={14} color="var(--text-dim)" />
                      <h3>{subject}</h3>
                   </div>

                   <div className="course-mgmt-grid">
                      {subjectCourses.sort((a,b) => a.grade - b.grade).map((course, i) => (
                        <div key={course.id} className="glass-card course-mgmt-card animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                           <div className="course-info-tag">
                              <span className="role-tag role-tag--student">GRADE {course.grade}</span>
                              {course.is_core && <span className="stat-lbl" style={{ color: 'var(--role-student)' }}>CORE NODE</span>}
                           </div>

                           <div className="mgmt-title">{course.title}</div>
                           <p className="mgmt-desc">
                              {course.description 
                                ? (course.description.length > 90 ? course.description.slice(0, 90) + "..." : course.description)
                                : "No architectural description provided for this node."}
                           </p>

                           <div className="mgmt-actions">
                              <button className="btn--ghost sm" onClick={() => navigate(`/admin/content/courses/${course.id}/lessons`)}>
                                 <BookOpen size={12} /> UNITS
                              </button>
                              <button className="btn--ghost sm" style={{ color: 'var(--warning)' }} onClick={() => navigate(`/admin/content/courses/${course.id}/assessments`)}>
                                 <Award size={12} /> EVAL
                              </button>
                           </div>
                        </div>
                      ))}
                   </div>
                </section>
              ))}
          </div>
        )}

        {/* Modal: New Course */}
        {showNewCourse && (
          <div className="obsidian-modal-overlay animate-fade-in" onClick={() => setShowNewCourse(false)}>
             <div className="glass-card obsidian-modal animate-scale-up" onClick={e => e.stopPropagation()}>
                <div className="modal-header-nexus">
                   <div className="inst-label">CURRICULUM ARCHITECT</div>
                   <h2 className="modal-title">INSTANTIATE NODE</h2>
                </div>

                {createError && <div className="alert alert--error" style={{ marginBottom: '20px' }}>{createError}</div>}

                <div className="obsidian-form-group">
                   <label className="obsidian-label">SUBJECT PROTOCOL *</label>
                   <select className="obsidian-select" value={newSubjectId} onChange={e => setNewSubjectId(Number(e.target.value))}>
                      <option value="">Select subject...</option>
                      {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                   </select>
                </div>

                <div className="obsidian-form-group">
                   <label className="obsidian-label">GRADE SPAN *</label>
                   <select className="obsidian-select" value={newGrade} onChange={e => setNewGrade(Number(e.target.value))}>
                      <option value="">Select grade...</option>
                      {[6,7,8,9,10].map(g => <option key={g} value={g}>Class {g}</option>)}
                   </select>
                </div>

                <div className="obsidian-form-group">
                   <label className="obsidian-label">NODE TITLE *</label>
                   <input className="obsidian-input" type="text" placeholder="e.g. Advanced Bio-Sciences" value={newTitle} onChange={e => setNewTitle(e.target.value)} />
                </div>

                <div className="obsidian-form-group">
                   <label className="obsidian-label">ARCHITECTURAL DATA</label>
                   <textarea className="obsidian-textarea" rows={3} placeholder="Describe the curriculum node purpose..." value={newDesc} onChange={e => setNewDesc(e.target.value)} />
                </div>

                <div className="mgmt-actions" style={{ gap: '12px', marginTop: 'var(--space-8)' }}>
                   <button className="btn--primary" style={{ flex: 1 }} disabled={creating} onClick={handleCreateCourse}>
                      {creating ? "INSTANTIATING..." : "CREATE NODE"}
                   </button>
                   <button className="btn--secondary" onClick={() => setShowNewCourse(false)} disabled={creating}>
                      CANCEL
                   </button>
                </div>
             </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default AdminContentPage;
