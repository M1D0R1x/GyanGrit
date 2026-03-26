import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";
import BottomNav from "../components/BottomNav";
import { useAuth } from "../auth/AuthContext";
import { 
  ShieldCheck, 
  Map, 
  Building2, 
  GraduationCap, 
  BookOpen, 
  Award,
  ChevronRight,
  Monitor,
  CheckCircle2,
  TrendingUp,
  BarChart3
} from 'lucide-react';
import './OfficialDashboardPage.css';

type CourseAnalytics = {
  course_id: number;
  title: string;
  subject: string;
  grade: number;
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
};

type ClassAnalytics = {
  class_id: number;
  class_name: string;
  institution: string;
  total_students: number;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
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

const COURSE_PREVIEW     = 6;
const ASSESSMENT_PREVIEW = 5;

const OfficialDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading]         = useState(true);
  const [classes, setClasses]         = useState<ClassAnalytics[]>([]);
  const [courses, setCourses]         = useState<CourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<AssessmentAnalytics[]>([]);

  const [selectedInstitution, setSelectedInstitution] = useState<string | null>(null);
  const [showAllCourses, setShowAllCourses]            = useState(false);
  const [showAllAssessments, setShowAllAssessments]    = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [c, co, a] = await Promise.all([
          apiGet<ClassAnalytics[]>("/teacher/analytics/classes/"),
          apiGet<CourseAnalytics[]>("/teacher/analytics/courses/"),
          apiGet<AssessmentAnalytics[]>("/teacher/analytics/assessments/"),
        ]);
        if (!cancelled) {
          setClasses(c ?? []);
          setCourses(co ?? []);
          setAssessments(a ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const institutions = [...new Set(classes.map((c) => c.institution))].sort();
  const filteredClasses = selectedInstitution
    ? classes.filter((c) => c.institution === selectedInstitution)
    : classes;
  const totalStudents = classes.reduce((sum, c) => sum + c.total_students, 0);
  const avgPassRate = classes.length
    ? Math.round(classes.reduce((sum, c) => sum + c.pass_rate, 0) / classes.length)
    : 0;

  const shownCourses = showAllCourses ? courses : courses.slice(0, COURSE_PREVIEW);
  const shownAssessments = showAllAssessments ? assessments : assessments.slice(0, ASSESSMENT_PREVIEW);

  if (loading) {
    return (
      <div className="page-shell">
        <TopBar title="Oversight Terminal" />
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
      <TopBar title="District Administration" />
      <main className="page-content page-enter has-bottom-nav official-dash-layout">

        {/* District Banner */}
        <section className="district-nexus glass-card animate-fade-up">
           <div className="district-header">
              <div className="district-info">
                 <span className="district-label">BLOCK TELEMETRY HUB</span>
                 <h1 className="district-name">{user?.district || "ALL DISTRICTS"} JURISDICTION</h1>
                 <p className="hero-subtitle">Aggregated data protocols from {institutions.length} educational nodes.</p>
              </div>
              <button className="btn--secondary sm" onClick={() => navigate("/official/users")}>
                 <ShieldCheck size={14} /> MANAGE PRINCIPAL CODES
              </button>
           </div>

           <div className="district-metrics">
              <div className="inst-stat">
                 <span className="inst-val">{institutions.length}</span>
                 <span className="inst-lbl">SCHOOLS</span>
              </div>
              <div className="inst-stat">
                 <span className="inst-val" style={{ color: 'var(--role-official)' }}>{totalStudents}</span>
                 <span className="inst-lbl">TOTAL NODES</span>
              </div>
              <div className="inst-stat">
                 <span className="inst-val" style={{ color: avgPassRate >= 70 ? 'var(--role-student)' : 'var(--warning)' }}>{avgPassRate}%</span>
                 <span className="inst-lbl">DISTRICT PASS</span>
              </div>
              <div className="inst-stat">
                 <span className="inst-val" style={{ color: 'var(--brand-primary)' }}>{courses.length}</span>
                 <span className="inst-lbl">ACTIVE UNITS</span>
              </div>
           </div>
        </section>

        {/* School Filters */}
        <div className="section-nexus-header animate-fade-up" style={{ animationDelay: '50ms' }}>
           <div className="nexus-header-text">
              <h2><Building2 size={16} color="var(--role-official)" /> JURISDICTION NODES</h2>
           </div>
        </div>

        <div className="institution-filter-nexus animate-fade-up" style={{ animationDelay: '100ms' }}>
           <button className={`inst-filter-pill ${!selectedInstitution ? 'active' : ''}`} onClick={() => setSelectedInstitution(null)}>
              ALL SCHOOLS ({classes.length} classes)
           </button>
           {institutions.map((inst) => (
             <button key={inst} className={`inst-filter-pill ${selectedInstitution === inst ? 'active' : ''}`} onClick={() => setSelectedInstitution(inst)}>
                {inst}
             </button>
           ))}
        </div>

        <div className="official-metric-grid">
           {filteredClasses.map((c, i) => {
             const passColor = c.pass_rate >= 70 ? "var(--role-student)" : c.pass_rate >= 40 ? "var(--warning)" : "var(--error)";
             return (
               <div key={c.class_id} className="glass-card official-card animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                  <span className="inst-tag">{c.institution}</span>
                  <div className="card-title">CLASS {c.class_name}</div>
                  
                  <div className="agg-nexus">
                     <div className="agg-stat">
                        <span className="agg-val">{c.total_students}</span>
                        <span className="agg-lbl">NODES</span>
                     </div>
                     <div className="agg-stat">
                        <span className="agg-val" style={{ color: passColor }}>{c.pass_rate}%</span>
                        <span className="agg-lbl">PERF</span>
                     </div>
                     <div className="agg-stat">
                        <span className="agg-val">{c.total_attempts}</span>
                        <span className="agg-lbl">ATMP</span>
                     </div>
                  </div>

                  <div className="pass-rate-nexus" style={{ marginTop: 'var(--space-4)' }}>
                     <div className="rate-bar-container">
                        <div className="rate-bar-fill" style={{ width: `${c.pass_rate}%`, background: passColor }} />
                     </div>
                  </div>
               </div>
             );
           })}
        </div>

        {/* Global Course Analytics */}
        <div className="section-nexus-header animate-fade-up" style={{ animationDelay: '150ms' }}>
           <div className="nexus-header-text">
              <h2><Map size={16} color="var(--role-official)" /> DISTRICT CURRICULUM SATURATION</h2>
           </div>
        </div>

        <div className="official-metric-grid">
           {shownCourses.map((course, i) => (
             <div key={course.course_id} className="glass-card official-card animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="card-header">
                   <span className="role-tag role-tag--student">GRADE {course.grade}</span>
                   <span className="stat-lbl">{course.subject}</span>
                </div>
                <div className="card-title" style={{ fontSize: '15px' }}>{course.title}</div>
                
                <div className="agg-nexus">
                   <div className="agg-stat" style={{ gridColumn: 'span 2', textAlign: 'left' }}>
                      <span className="agg-lbl">SYNCED UNITS</span>
                      <div className="agg-val">{course.completed_lessons} / {course.total_lessons}</div>
                   </div>
                   <div className="agg-stat" style={{ textAlign: 'right' }}>
                      <span className="agg-lbl">SATURATION</span>
                      <div className="agg-val" style={{ color: 'var(--role-student)' }}>{course.percentage}%</div>
                   </div>
                </div>

                <div className="pass-rate-nexus" style={{ marginTop: 'var(--space-4)' }}>
                   <div className="rate-bar-container">
                      <div className="rate-bar-fill" style={{ width: `${course.percentage}%`, background: 'var(--role-student)' }} />
                   </div>
                   <TrendingUp size={12} color="var(--role-official)" />
                </div>
             </div>
           ))}
        </div>
        {courses.length > COURSE_PREVIEW && (
          <button className="btn--ghost sm full" onClick={() => setShowAllCourses(v => !v)} style={{ marginTop: 'var(--space-4)' }}>
             {showAllCourses ? "COLLAPSE CURRICULUM" : `EXPAND DISTRICT CURRICULUM (${courses.length})`}
          </button>
        )}

        {/* Global Assessment Analytics */}
        <div className="section-nexus-header animate-fade-up" style={{ animationDelay: '200ms' }}>
           <div className="nexus-header-text">
              <h2><BarChart3 size={16} color="var(--role-official)" /> AGGREGATED EVALUATION PERFORMANCE</h2>
           </div>
        </div>

        <div className="official-metric-grid">
           {shownAssessments.map((a, i) => (
             <div key={a.assessment_id} className="glass-card official-card animate-fade-up" style={{ animationDelay: `${i * 30}ms` }}>
                <div className="card-header">
                   <span className="stat-lbl">{a.subject || a.course}</span>
                   <span className="role-tag" style={{ background: 'var(--role-student)11', color: 'var(--role-student)' }}>PEAK {a.pass_rate}%</span>
                </div>
                <div className="card-title" style={{ fontSize: '15px' }}>{a.title}</div>

                <div className="agg-nexus">
                   <div className="agg-stat">
                      <span className="agg-val">{a.total_attempts}</span>
                      <span className="agg-lbl">ATMP</span>
                   </div>
                   <div className="agg-stat">
                      <span className="agg-val">{a.unique_students}</span>
                      <span className="agg-lbl">NODES</span>
                   </div>
                   <div className="agg-stat">
                      <span className="agg-val" style={{ color: 'var(--role-student)' }}>{a.average_score}</span>
                      <span className="agg-lbl">AVG</span>
                   </div>
                </div>

                <div className="pass-rate-nexus" style={{ marginTop: 'var(--space-4)' }}>
                   <div className="rate-bar-container">
                      <div className="rate-bar-fill" style={{ width: `${a.pass_rate}%`, background: a.pass_rate >= 70 ? 'var(--role-student)' : 'var(--warning)' }} />
                   </div>
                </div>
             </div>
           ))}
        </div>

      </main>
      <BottomNav />
    </div>
  );
};

export default OfficialDashboardPage;
