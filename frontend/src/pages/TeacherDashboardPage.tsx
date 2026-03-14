import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getTeacherCourseAnalytics,
  getTeacherAssessmentAnalytics,
  getTeacherClassAnalytics,
  type TeacherCourseAnalytics,
  type TeacherAssessmentAnalytics,
  type TeacherClassAnalytics,
} from "../services/teacherAnalytics";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type MyAssignment = {
  subject_id: number;
  subject_name: string;
  section_id: number;
  section_name: string;
  class_name: string;
};

// ─── Reusable skeleton ───────────────────────────────────────────────────────
const Skeleton = ({ h = 140, count = 3 }: { h?: number; count?: number }) => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
    {[...Array(count)].map((_, i) => (
      <div key={i} style={{ height: h, borderRadius: 10, background: "linear-gradient(90deg,#f0f0f0 25%,#e0e0e0 50%,#f0f0f0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite" }} />
    ))}
  </div>
);

// ─── Stat pill ────────────────────────────────────────────────────────────────
const Pill = ({ label, value }: { label: string; value: string | number }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", background: "#f4f6fb", borderRadius: 8, padding: "10px 16px", minWidth: 80 }}>
    <span style={{ fontSize: 18, fontWeight: 700, color: "#1a56db" }}>{value}</span>
    <span style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>{label}</span>
  </div>
);

// ─── Progress bar ─────────────────────────────────────────────────────────────
const ProgressBar = ({ pct }: { pct: number }) => (
  <div style={{ background: "#e5e7eb", borderRadius: 99, height: 6, marginTop: 10 }}>
    <div style={{ width: `${pct}%`, background: pct >= 70 ? "#16a34a" : pct >= 40 ? "#f59e0b" : "#ef4444", height: "100%", borderRadius: 99, transition: "width .4s" }} />
  </div>
);

export default function TeacherDashboardPage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState<TeacherCourseAnalytics[]>([]);
  const [assessments, setAssessments] = useState<TeacherAssessmentAnalytics[]>([]);
  const [classes, setClasses] = useState<TeacherClassAnalytics[]>([]);
  const [assignments, setAssignments] = useState<MyAssignment[]>([]);

  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingAssessments, setLoadingAssessments] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingAssignments, setLoadingAssignments] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      getTeacherCourseAnalytics().then(d => { setCourses(d || []); setLoadingCourses(false); }),
      getTeacherAssessmentAnalytics().then(d => { setAssessments(d || []); setLoadingAssessments(false); }),
      getTeacherClassAnalytics().then(d => { setClasses(d || []); setLoadingClasses(false); }),
      apiGet<MyAssignment[]>("/academics/my-assignments/").then(d => { setAssignments(d || []); setLoadingAssignments(false); }),
    ]);
  }, []);

  // Group assignments by subject
  const subjectMap = assignments.reduce<Record<string, string[]>>((acc, a) => {
    if (!acc[a.subject_name]) acc[a.subject_name] = [];
    acc[a.subject_name].push(`Class ${a.class_name}`);
    return acc;
  }, {});

  // Deduplicate class names per subject
  Object.keys(subjectMap).forEach(k => {
    subjectMap[k] = [...new Set(subjectMap[k])].sort();
  });

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 64px" }}>
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        .class-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.10) !important; }
      `}</style>

      <TopBar title="Teacher Dashboard" />

      {/* ── MY SUBJECTS ─────────────────────────────────────────────────── */}
      <Section title="My Subjects">
        {loadingAssignments ? <Skeleton h={100} count={3} /> :
          Object.keys(subjectMap).length === 0 ? <Empty msg="No teaching assignments found." /> :
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {Object.entries(subjectMap).map(([subject, cls]) => (
              <div key={subject} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: 16 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: "#1e40af", marginBottom: 8 }}>{subject}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {cls.map(c => (
                    <span key={c} style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 99, padding: "2px 10px", fontSize: 12, fontWeight: 500 }}>{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        }
      </Section>

      {/* ── CLASS PERFORMANCE ───────────────────────────────────────────── */}
      <Section title="Class Performance">
        {loadingClasses ? <Skeleton h={130} count={5} /> :
          classes.length === 0 ? <Empty msg="No class data yet — students may not be enrolled." /> :
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {classes.map(c => (
              <div
                key={c.class_id}
                className="class-card"
                onClick={() => navigate(`/teacher/classes/${c.class_id}`)}
                style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 18, background: "#fff", cursor: "pointer", transition: "transform .2s, box-shadow .2s" }}
              >
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 12 }}>Class {c.class_name}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Pill label="Students" value={c.total_students} />
                  <Pill label="Pass Rate" value={`${c.pass_rate}%`} />
                </div>
                <ProgressBar pct={c.pass_rate} />
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 6 }}>Click to view students →</div>
              </div>
            ))}
          </div>
        }
      </Section>

      {/* ── COURSE COMPLETION ───────────────────────────────────────────── */}
      <Section title="Course Completion">
        {loadingCourses ? <Skeleton h={120} count={3} /> :
          courses.length === 0 ? <Empty msg="No courses found for your subject." /> :
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {courses.map(course => (
              <div key={course.course_id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 18, background: "#fff" }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>{course.title}</div>
                <div style={{ display: "flex", gap: 10 }}>
                  <Pill label="Completed" value={course.completed_lessons} />
                  <Pill label="Total" value={course.total_lessons} />
                  <Pill label="%" value={`${course.percentage}%`} />
                </div>
                <ProgressBar pct={course.percentage} />
              </div>
            ))}
          </div>
        }
      </Section>

      {/* ── ASSESSMENT PERFORMANCE ──────────────────────────────────────── */}
      <Section title="Assessment Performance">
        {loadingAssessments ? <Skeleton h={140} count={3} /> :
          assessments.length === 0 ? <Empty msg="No assessments data yet." /> :
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
            {assessments.map(a => (
              <div key={a.assessment_id} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 18, background: "#fff" }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>{a.title}</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 12 }}>{a.course}</div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <Pill label="Attempts" value={a.total_attempts} />
                  <Pill label="Students" value={a.unique_students} />
                  <Pill label="Pass Rate" value={`${a.pass_rate}%`} />
                </div>
                <ProgressBar pct={a.pass_rate} />
              </div>
            ))}
          </div>
        }
      </Section>
    </div>
  );
}

// ─── Layout helpers ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 48 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", marginBottom: 16, paddingBottom: 8, borderBottom: "2px solid #e5e7eb" }}>{title}</h2>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p style={{ color: "#9ca3af", fontStyle: "italic", padding: "20px 0" }}>{msg}</p>;
}