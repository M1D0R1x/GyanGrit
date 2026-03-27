import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../auth/AuthContext";
import './PrincipalDashboardPage.css';

// ── Icons ────────────────────────────────────────────────────────
const SvgBuilding2 = ({ size=24, color="currentColor", ...props}: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>);
const SvgUsers = ({ size=24, color="currentColor", ...props}: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>);
const SvgMapPin = ({ size=24, color="currentColor", ...props}: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>);
const SvgShieldCheck = ({ size=24, color="currentColor", ...props}: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/></svg>);
const SvgBookOpen = ({ size=24, color="currentColor", ...props}: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>);
const SvgAward = ({ size=24, color="currentColor", ...props}: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/></svg>);
const SvgChevronRight = ({ size=24, color="currentColor", ...props}: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m9 18 6-6-6-6"/></svg>);
const SvgTrendingUp = ({ size=24, color="currentColor", ...props}: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>);
const SvgUserCheck = ({ size=24, color="currentColor", ...props}: any) => (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="m16 11 2 2 4-4"/></svg>);


type ClassData = {
  class_id: number;
  class_name: string;
  institution: string;
  total_students: number;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
};

type TeacherData = {
  id: number;
  username: string;
};

type CourseAnalytics = {
  course_id: number;
  title: string;
  subject: string;
  grade: number;
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
};

type AssessmentAnalytics = {
  assessment_id: number;
  title: string;
  course: string;
  subject: string | null;
  total_attempts: number;
  unique_students: number;
  average_score: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
};

const CLASS_PAGE          = 6;
const COURSE_PREVIEW      = 6;
const ASSESSMENT_PREVIEW  = 5;

const PrincipalDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [classes, setClasses]         = useState<ClassData[]>([]);
  const [teachers, setTeachers]       = useState<TeacherData[]>([]);
  const [courses, setCourses]         = useState<CourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<AssessmentAnalytics[]>([]);
  
  const [visibleClasses, setVisibleClasses]        = useState(CLASS_PAGE);
  const [showAllCourses, setShowAllCourses]         = useState(false);
  const [showAllAssessments, setShowAllAssessments] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      try {
        const results = await Promise.allSettled([
          apiGet<ClassData[]>("/teacher/analytics/classes/"),
          apiGet<TeacherData[]>("/accounts/teachers/"),
          apiGet<CourseAnalytics[]>("/teacher/analytics/courses/"),
          apiGet<AssessmentAnalytics[]>("/teacher/analytics/assessments/"),
        ]);
        
        if (!cancelled) {
          const [c, t, co, a] = results;
          if (c.status === "fulfilled") setClasses(c.value ?? []);
          if (t.status === "fulfilled") setTeachers(t.value ?? []);
          if (co.status === "fulfilled") setCourses(co.value ?? []);
          if (a.status === "fulfilled") setAssessments(a.value ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("SIGNAL LOST: Administrative analytics unreachable.");
          setLoading(false);
        }
      }
    }
    loadData();
    return () => { cancelled = true; };
  }, []);

  const totalStudents = classes.reduce((s, c) => s + c.total_students, 0);
  const avgPassRate = classes.length
    ? Math.round(classes.reduce((s, c) => s + c.pass_rate, 0) / classes.length)
    : 0;

  const shownClasses = classes.slice(0, visibleClasses);
  const hasMoreClasses = visibleClasses < classes.length;
  const shownCourses = showAllCourses ? courses : courses.slice(0, COURSE_PREVIEW);
  const shownAssessments = showAllAssessments ? assessments : assessments.slice(0, ASSESSMENT_PREVIEW);

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Administrative Terminal" />
        <main className="page-content has-bottom-nav">
          <div className="skeleton-stack animate-pulse-subtle">
             <div className="skeleton-box" style={{ height: '180px', marginBottom: '30px' }} />
             <div className="skeleton-box" style={{ height: '400px' }} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <TopBar title="Executive Interface" />
      <main className="page-content page-enter has-bottom-nav principal-dash-layout">

        {/* Institution Banner */}
        <section className="institution-nexus glass-card animate-fade-up">
           <div className="inst-header">
              <div className="inst-info">
                 <span className="inst-label">AUTHORITY DOMAIN</span>
                 <h1 className="inst-name">{user?.institution || "UNIDENTIFIED INSTITUTION"}</h1>
                 <div className="inst-sub">
                    <SvgMapPin size={12} /> {user?.district || "Unknown"} District Proxy
                 </div>
              </div>
              <button className="btn--secondary sm" onClick={() => navigate("/principal/users")}>
                 <SvgShieldCheck size={14} /> MANAGE JOIN CODES
              </button>
           </div>

           <div className="inst-metrics">
              <div className="inst-stat">
                 <span className="inst-val">{classes.length}</span>
                 <span className="inst-lbl">CLASSES</span>
              </div>
              <div className="inst-stat">
                 <span className="inst-val" style={{ color: 'var(--role-student)' }}>{totalStudents}</span>
                 <span className="inst-lbl">STUDENTS</span>
              </div>
              <div className="inst-stat">
                 <span className="inst-val" style={{ color: avgPassRate >= 70 ? 'var(--role-student)' : 'var(--warning)' }}>{avgPassRate}%</span>
                 <span className="inst-lbl">AVG PASS</span>
              </div>
              <div className="inst-stat">
                 <span className="inst-val" style={{ color: 'var(--role-teacher)' }}>{teachers.length}</span>
                 <span className="inst-lbl">TEACHERS</span>
              </div>
           </div>
        </section>

        {error && <div className="alert alert--error">{error}</div>}

        {/* Classes Nexus */}
        <div className="section-nexus-header animate-fade-up" style={{ animationDelay: '50ms' }}>
           <div className="nexus-header-text">
              <h2><SvgBuilding2 size={16} color="var(--role-principal)" /> CLASSROOM CLUSTERS</h2>
           </div>
        </div>

        <div className="nexus-grid">
           {shownClasses.map((c, i) => {
             const passColor = c.pass_rate >= 70 ? "var(--role-student)" : c.pass_rate >= 40 ? "var(--warning)" : "var(--error)";
             return (
               <div key={c.class_id} className="glass-card principal-card clickable animate-fade-up"
                    onClick={() => navigate(`/principal/classes/${c.class_id}`)}
                    style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="card-header">
                     <span className="metric-label">SECTOR {c.class_id}</span>
                     <SvgChevronRight size={14} color="var(--text-dim)" />
                  </div>
                  <div className="card-title">CLASS {c.class_name}</div>
                  
                  <div className="metric-stats" style={{ margin: 'var(--space-4) 0' }}>
                     <div className="stat-unit">
                        <span className="stat-val">{c.total_students}</span>
                        <span className="stat-lbl">NODES</span>
                     </div>
                     <div className="stat-unit" style={{ textAlign: 'right' }}>
                        <span className="stat-val" style={{ color: passColor }}>{c.pass_rate}%</span>
                        <span className="stat-lbl">VALIDATION</span>
                     </div>
                  </div>

                  <div className="pass-rate-nexus">
                     <div className="rate-bar-container">
                        <div className="rate-bar-fill" style={{ width: `${c.pass_rate}%`, background: passColor }} />
                     </div>
                  </div>
                  <span className="stat-lbl" style={{ marginTop: 'var(--space-2)' }}>{c.total_attempts} Attempts registered</span>
               </div>
             );
           })}
        </div>
        {hasMoreClasses && (
          <button className="btn--ghost sm full" onClick={() => setVisibleClasses(v => v + CLASS_PAGE)} style={{ marginTop: 'var(--space-4)' }}>
             EXPAND CLASS CLUSTERS ({classes.length - visibleClasses} remaining)
          </button>
        )}

        {/* Course Analytics */}
        <div className="section-nexus-header animate-fade-up" style={{ animationDelay: '100ms' }}>
           <div className="nexus-header-text">
              <h2><SvgBookOpen size={16} color="var(--role-principal)" /> CURRICULUM SATURATION</h2>
           </div>
        </div>

        <div className="nexus-grid">
           {shownCourses.map((course, i) => (
             <div key={course.course_id} className="glass-card principal-card clickable animate-fade-up"
                  onClick={() => navigate(`/principal/courses/${course.course_id}/lessons`)}
                  style={{ animationDelay: `${i * 30}ms` }}>
                <div className="card-header">
                   <span className="role-tag role-tag--student">GRADE {course.grade}</span>
                   <span className="stat-lbl">{course.subject}</span>
                </div>
                <div className="card-title" style={{ fontSize: '15px' }}>{course.title}</div>
                
                <div className="metric-stats" style={{ margin: 'var(--space-4) 0' }}>
                   <div className="stat-unit">
                      <span className="stat-val">{course.completed_lessons} / {course.total_lessons}</span>
                      <span className="stat-lbl">UNITS SYNCED</span>
                   </div>
                   <div className="stat-unit" style={{ textAlign: 'right' }}>
                      <span className="stat-val" style={{ color: 'var(--role-student)' }}>{course.percentage}%</span>
                      <span className="stat-lbl">COMPLETION</span>
                   </div>
                </div>

                <div className="pass-rate-nexus">
                   <div className="rate-bar-container">
                      <div className="rate-bar-fill" style={{ width: `${course.percentage}%`, background: 'var(--role-student)' }} />
                   </div>
                   <SvgTrendingUp size={12} color="var(--role-principal)" />
                </div>
             </div>
           ))}
        </div>
        {courses.length > COURSE_PREVIEW && (
          <button className="btn--ghost sm full" onClick={() => setShowAllCourses(v => !v)} style={{ marginTop: 'var(--space-4)' }}>
             {showAllCourses ? "COLLAPSE CURRICULUM" : `EXPAND FULL CURRICULUM (${courses.length})`}
          </button>
        )}

        {/* Assessment Analytics */}
        <div className="section-nexus-header animate-fade-up" style={{ animationDelay: '150ms' }}>
           <div className="nexus-header-text">
              <h2><SvgAward size={16} color="var(--role-principal)" /> EVALUATION PERFORMANCE</h2>
           </div>
        </div>

        <div className="nexus-grid">
           {shownAssessments.map((a, i) => (
             <div key={a.assessment_id} className="glass-card principal-card animate-fade-up"
                  style={{ animationDelay: `${i * 30}ms` }}>
                <div className="card-header">
                   <span className="stat-lbl">{a.subject || a.course}</span>
                   <span className="role-tag" style={{ background: 'var(--role-student)11', color: 'var(--role-student)' }}>PEAK {a.pass_rate}%</span>
                </div>
                <div className="card-title" style={{ fontSize: '15px' }}>{a.title}</div>

                <div className="assessment-nexus" style={{ margin: 'var(--space-4) 0' }}>
                   <div className="a-stat">
                      <div className="a-val">{a.total_attempts}</div>
                      <div className="a-lbl">ATTEMPTS</div>
                   </div>
                   <div className="a-stat">
                      <div className="a-val">{a.unique_students}</div>
                      <div className="a-lbl">NODES</div>
                   </div>
                   <div className="a-stat">
                      <div className="a-val" style={{ color: 'var(--role-student)' }}>{a.pass_rate}%</div>
                      <div className="a-lbl">PASS</div>
                   </div>
                </div>

                <div className="pass-rate-nexus">
                   <div className="rate-bar-container">
                      <div className="rate-bar-fill" style={{ width: `${a.pass_rate}%`, background: a.pass_rate >= 70 ? 'var(--role-student)' : 'var(--warning)' }} />
                   </div>
                </div>
             </div>
           ))}
        </div>

        {/* Teachers List */}
        <div className="section-nexus-header animate-fade-up" style={{ animationDelay: '200ms' }}>
           <div className="nexus-header-text">
              <h2><SvgUserCheck size={16} color="var(--role-principal)" /> PERSONNEL REGISTRY</h2>
           </div>
        </div>

        <div className="teacher-grid">
           {teachers.map((t, i) => (
             <div key={t.id} className="glass-card teacher-card animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="teacher-avatar">{t.username.slice(0, 2).toUpperCase()}</div>
                <div className="teacher-info">
                   <span className="teacher-name">{t.username}</span>
                   <span className="teacher-role">INSTRUCTOR</span>
                </div>
             </div>
           ))}
        </div>

      </main>
      <BottomNav />
    </div>
  );
};

export default PrincipalDashboardPage;
