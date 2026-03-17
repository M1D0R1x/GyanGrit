import { apiGet } from "./api";

// ── Course Analytics ───────────────────────────────────────────────────────
// GET /api/v1/teacher/analytics/courses/
// Scoped: TEACHER → their subjects only; PRINCIPAL/OFFICIAL/ADMIN → their scope

export type TeacherCourseAnalytics = {
  course_id:          number;   // was "id" — fixed 2026-03-18
  title:              string;
  subject:            string;
  grade:              number;
  total_lessons:      number;
  completed_lessons:  number;   // distinct lessons with at least one completion
  percentage:         number;   // completed_lessons / total_lessons * 100
  enrolled_students:  number;
  completed_students: number;
};

export function getTeacherCourseAnalytics() {
  return apiGet<TeacherCourseAnalytics[]>("/teacher/analytics/courses/");
}

// ── Lesson Analytics ───────────────────────────────────────────────────────
// GET /api/v1/teacher/analytics/lessons/?course_id=N

export type TeacherLessonAnalytics = {
  id:        number;
  title:     string;
  order:     number;
  views:     number;
  completed: number;
};

export function getTeacherLessonAnalytics(courseId: number) {
  return apiGet<TeacherLessonAnalytics[]>(`/teacher/analytics/lessons/?course_id=${courseId}`);
}

// ── Assessment Analytics ───────────────────────────────────────────────────
// GET /api/v1/teacher/analytics/assessments/
// Scoped: TEACHER → their subjects only

export type TeacherAssessmentAnalytics = {
  assessment_id:   number;   // was "id" — fixed 2026-03-18
  title:           string;
  grade:           number;
  subject:         string;
  course:          string;   // course title — added 2026-03-18
  course_id:       number;
  total_marks:     number;
  pass_marks:      number;
  total_attempts:  number;
  unique_students: number;   // added 2026-03-18
  pass_count:      number;
  fail_count:      number;   // added 2026-03-18
  pass_rate:       number;   // added 2026-03-18
  average_score:   number;   // was "avg_score" — fixed 2026-03-18
};

export function getTeacherAssessmentAnalytics() {
  return apiGet<TeacherAssessmentAnalytics[]>("/teacher/analytics/assessments/");
}

// ── Class Analytics ────────────────────────────────────────────────────────
// GET /api/v1/teacher/analytics/classes/
// TEACHER → their assigned classrooms; others → scoped

export type TeacherClassAnalytics = {
  class_id:       number;   // was "id" — fixed 2026-03-18
  class_name:     string;   // was "name" — fixed 2026-03-18
  institution:    string | null;
  total_students: number;   // added 2026-03-18
  total_attempts: number;   // added 2026-03-18
  pass_rate:      number;   // added 2026-03-18
};

export function getTeacherClassAnalytics() {
  return apiGet<TeacherClassAnalytics[]>("/teacher/analytics/classes/");
}

// ── Class Students ─────────────────────────────────────────────────────────
// GET /api/v1/teacher/analytics/classes/<id>/students/

export type TeacherClassStudent = {
  id:                number;
  username:          string;
  display_name:      string;
  total_lessons:     number;
  completed_lessons: number;
};

export function getTeacherClassStudents(classId: number) {
  return apiGet<TeacherClassStudent[]>(`/teacher/analytics/classes/${classId}/students/`);
}

// ── Student Assessment Detail ──────────────────────────────────────────────
// GET /api/v1/teacher/analytics/classes/<id>/students/<id>/

export type TeacherStudentAttempt = {
  assessment_id:    number;
  assessment_title: string;
  score:            number;
  passed:           boolean;
  submitted_at:     string;
};

export type TeacherStudentDetailResponse = {
  student_id: number;
  username:   string;
  attempts:   TeacherStudentAttempt[];
};

export function getTeacherStudentAssessments(classId: number, studentId: number) {
  return apiGet<TeacherStudentDetailResponse>(
    `/teacher/analytics/classes/${classId}/students/${studentId}/`
  );
}
