import { apiGet } from "./api";

/* =========================
   COURSE ANALYTICS
   Backend: content/views.py teacher_course_analytics
   Returns: course_id, title, subject, grade,
            total_lessons, completed_lessons, percentage
========================= */

export type TeacherCourseAnalytics = {
  course_id: number;
  title: string;
  subject: string;        // added — backend now returns this
  grade: number;          // added — backend now returns this
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
};

export function getTeacherCourseAnalytics() {
  return apiGet<TeacherCourseAnalytics[]>("/teacher/analytics/courses/");
}

/* =========================
   LESSON ANALYTICS
   Backend: content/views.py teacher_lesson_analytics
========================= */

export type TeacherLessonAnalytics = {
  lesson_id: number;
  lesson_title: string;
  course_title: string;
  completed_count: number;
  total_attempts: number;
  avg_position: number;
};

export function getTeacherLessonAnalytics() {
  return apiGet<TeacherLessonAnalytics[]>("/teacher/analytics/lessons/");
}

/* =========================
   ASSESSMENT ANALYTICS
   Backend: content/views.py teacher_assessment_analytics
========================= */

export type TeacherAssessmentAnalytics = {
  assessment_id: number;
  title: string;
  course: string;
  subject: string | null;   // added — backend now returns this
  total_attempts: number;
  unique_students: number;
  average_score: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
};

export function getTeacherAssessmentAnalytics() {
  return apiGet<TeacherAssessmentAnalytics[]>("/teacher/analytics/assessments/");
}

/* =========================
   CLASS ANALYTICS
   Backend: content/views.py teacher_class_analytics
========================= */

export type TeacherClassAnalytics = {
  class_id: number;
  class_name: string;
  institution: string;
  total_students: number;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
};

export function getTeacherClassAnalytics() {
  return apiGet<TeacherClassAnalytics[]>("/teacher/analytics/classes/");
}

/* =========================
   CLASS STUDENTS
   Backend: content/views.py teacher_class_students
========================= */

export type TeacherClassStudentAnalytics = {
  student_id: number;
  username: string;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
};

export function getTeacherClassStudents(classId: number) {
  return apiGet<TeacherClassStudentAnalytics[]>(
    `/teacher/analytics/classes/${classId}/students/`
  );
}

/* =========================
   STUDENT DETAIL
   Backend: content/views.py teacher_student_assessments
========================= */

export type TeacherStudentAssessmentDetail = {
  assessment_id: number;
  assessment_title: string;
  score: number;
  passed: boolean;
  submitted_at: string;
};

export type TeacherStudentDetailResponse = {
  student_id: number;
  username: string;
  attempts: TeacherStudentAssessmentDetail[];
};

export function getTeacherStudentAssessments(
  classId: number,
  studentId: number
) {
  return apiGet<TeacherStudentDetailResponse>(
    `/teacher/analytics/classes/${classId}/students/${studentId}/`
  );
}