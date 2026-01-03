import { useEffect, useState } from "react";
import {
  getTeacherCourseAnalytics,
  getTeacherLessonAnalytics,
    type TeacherCourseAnalytics,
    type TeacherLessonAnalytics,
} from "../services/teacherAnalytics";

export default function TeacherDashboardPage() {
  const [courses, setCourses] = useState<TeacherCourseAnalytics[]>([]);
  const [lessons, setLessons] = useState<TeacherLessonAnalytics[]>([]);

  useEffect(() => {
    getTeacherCourseAnalytics().then(setCourses);
    getTeacherLessonAnalytics().then(setLessons);
  }, []);

  return (
    <div>
      <h1>Teacher Dashboard</h1>

      <section>
        <h2>Course Overview</h2>
        <ul>
          {courses.map((c) => (
            <li key={c.course_id}>
              {c.title} — {c.percentage}% complete
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Lesson Analytics</h2>
        <ul>
          {lessons.map((l) => (
            <li key={l.lesson_id}>
              {l.course_title} → {l.lesson_title}
              ({l.completed_count}/{l.total_attempts})
              avg time: {l.avg_time_spent}s
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
