import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { getCourses, type CourseItem } from '../services/content';
import { apiGet } from '../services/api';

type GroupedCourses = Record<string, CourseItem[]>;

const AdminContentPage: React.FC = () => {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<CourseItem[]>([]);
  const [subjects, setSubjects] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [coursesData, subjectsData] = await Promise.all([
          getCourses(),
          apiGet<{ id: number; name: string }[]>("/academics/subjects/"),
        ]);
        setCourses(coursesData || []);
        setSubjects(subjectsData || []);
      } catch (err) {
        console.error("Content page load failed:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const grades = [...new Set(courses.map((c) => c.grade))].sort((a, b) => a - b);
  const filtered = selectedGrade ? courses.filter((c) => c.grade === selectedGrade) : courses;

  const grouped: GroupedCourses = filtered.reduce((acc, course) => {
    const key = course.subject__name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {} as GroupedCourses);

  if (loading) return (
    <div className="page-shell">
      <TopBar />
      <main className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="btn__spinner" style={{ width: 40, height: 40 }} />
      </main>
    </div>
  );

  return (
    <div className="page-shell">
      <TopBar title="Global Curriculum" />
      <main className="page-content page-enter">
        {/* Editorial Header */}
        <section className="editorial-header animate-fade-up">
           <div className="role-tag role-tag--admin" style={{ marginBottom: 'var(--space-4)' }}>
             🌐 Knowledge Architect
           </div>
           <h1 className="text-gradient" style={{ fontSize: 'clamp(28px, 6vw, 40px)', lineHeight: 1.1, marginBottom: 'var(--space-1)' }}>
             Shared Academic<br/>
             Infrastructure.
           </h1>
           <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-lg)', maxWidth: '500px' }}>
             Orchestrate the cross-institutional curriculum nodes for all scholars.
           </p>
        </section>

        {/* Action & Filter Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-8)' }}>
           <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button 
                className={`btn--${selectedGrade === null ? 'primary' : 'ghost'}`} 
                style={{ fontSize: '10px', padding: 'var(--space-2) var(--space-4)' }}
                onClick={() => setSelectedGrade(null)}
              >
                ALL GRADES
              </button>
              {grades.map(g => (
                <button 
                  key={g} 
                  className={`btn--${selectedGrade === g ? 'primary' : 'ghost'}`} 
                  style={{ fontSize: '10px', padding: 'var(--space-2) var(--space-4)' }}
                  onClick={() => setSelectedGrade(g)}
                >
                  CLASS {g}
                </button>
              ))}
           </div>
           <button className="btn--primary" style={{ fontSize: '12px' }}>+ INITIALIZE NEW COURSE</button>
        </div>

        {/* Groups Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-12)' }}>
          {Object.entries(grouped)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([subjectName, subjectCourses]) => (
              <div key={subjectName}>
                <div className="section-header">
                  <h2 className="section-header__title" style={{ fontSize: 'var(--text-xs)', opacity: 0.6 }}>{subjectName.toUpperCase()} DOMAIN</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 'var(--space-4)' }}>
                  {subjectCourses.map((course, i) => (
                    <div key={course.id} className="glass-card page-enter" style={{ padding: 'var(--space-5)', animationDelay: `${i * 50}ms`, border: '1px solid var(--brand-primary)22' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
                          <span className="role-tag role-tag--student" style={{ fontSize: '8px' }}>CLASS {course.grade}</span>
                          {course.is_core && <span style={{ fontSize: '8px', fontWeight: 800, color: 'var(--role-teacher)' }}>CORE</span>}
                       </div>
                       <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 700, marginBottom: 'var(--space-2)' }}>{course.title}</h3>
                       <p style={{ fontSize: '11px', color: 'var(--text-dim)', lineHeight: 1.5, marginBottom: 'var(--space-6)', minHeight: '33px' }}>
                         {course.description || "Experimental curriculum module for institutional deployment."}
                       </p>
                       <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)' }}>
                          <button 
                            className="btn--ghost" 
                            style={{ flex: 1, fontSize: '9px', color: 'var(--brand-primary)', fontWeight: 800 }}
                            onClick={() => navigate(`/admin/content/courses/${course.id}/lessons`)}
                          >
                            LESSONS
                          </button>
                          <button 
                            className="btn--ghost" 
                            style={{ flex: 1, fontSize: '9px', color: 'var(--role-principal)', fontWeight: 800 }}
                            onClick={() => navigate(`/admin/content/courses/${course.id}/assessments`)}
                          >
                            VALIDATION
                          </button>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      </main>
    </div>
  );
};

export default AdminContentPage;
