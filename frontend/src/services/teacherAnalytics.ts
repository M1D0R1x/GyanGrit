import { apiGet } from "./api";

/* =========================
   COURSE ANALYTICS
========================= */

export type TeacherCourseAnalytics = {
  course_id: number;
  title: string;
  total_lessons: number;
  completed_lessons: number;
  percentage: number;
};

export function getTeacherCourseAnalytics() {
  return apiGet<TeacherCourseAnalytics[]>("/content/teacher/analytics/courses/");
}

/* =========================
   LESSON ANALYTICS
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
  return apiGet<TeacherLessonAnalytics[]>("/content/teacher/analytics/lessons/");
}

/* =========================
   ASSESSMENT ANALYTICS
========================= */

export type TeacherAssessmentAnalytics = {
  assessment_id: number;
  title: string;
  course: string;               // ← fixed: added this property
  total_attempts: number;
  unique_students: number;
  average_score: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
};

export function getTeacherAssessmentAnalytics() {
  return apiGet<TeacherAssessmentAnalytics[]>("/content/teacher/analytics/assessments/");
}

/* =========================
   CLASS ANALYTICS
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
  return apiGet<TeacherClassAnalytics[]>("/content/teacher/analytics/classes/");
}

export type TeacherClassStudentAnalytics = {
  student_id: number;
  username: string;
  total_attempts: number;
  average_score: number;
  pass_rate: number;
};

export function getTeacherClassStudents(classId: number) {
  return apiGet<TeacherClassStudentAnalytics[]>(
    `/content/teacher/analytics/classes/${classId}/students/`
  );
}

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

export function getTeacherStudentAssessments(classId: number, studentId: number) {
  return apiGet<TeacherStudentDetailResponse>(
    `/content/teacher/analytics/classes/${classId}/students/${studentId}/`
  );
}