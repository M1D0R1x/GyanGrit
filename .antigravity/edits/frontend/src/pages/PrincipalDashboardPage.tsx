import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../auth/AuthContext";
import { 
  Building2, 
  Users, 
  MapPin, 
  ShieldCheck, 
  GraduationCap, 
  BookOpen, 
  Award,
  ChevronRight,
  TrendingUp,
  UserCheck
} from 'lucide-react';
import './PrincipalDashboardPage.css';

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
                    <MapPin size={12} /> {user?.district || "Unknown"} District Proxy
                 </div>
              </div>
              <button className="btn--secondary sm" onClick={() => navigate("/principal/users")}>
                 <ShieldCheck size={14} /> MANAGE JOIN CODES
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
              <h2><Building2 size={16} color="var(--role-principal)" /> CLASSROOM CLUSTERS</h2>
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
                     <ChevronRight size={14} color="var(--text-dim)" />
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
              <h2><BookOpen size={16} color="var(--role-principal)" /> CURRICULUM SATURATION</h2>
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
                   <TrendingUp size={12} color="var(--role-principal)" />
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
              <h2><Award size={16} color="var(--role-principal)" /> EVALUATION PERFORMANCE</h2>
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
              <h2><UserCheck size={16} color="var(--role-principal)" /> PERSONNEL REGISTRY</h2>
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
