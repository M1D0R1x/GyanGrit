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
  return apiGet<TeacherCourseAnalytics[]>(
    "/teacher/analytics/courses/"
  );
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
  avg_time_spent: number;
};

export function getTeacherLessonAnalytics() {
  return apiGet<TeacherLessonAnalytics[]>(
    "/teacher/analytics/lessons/"
  );
}

/* =========================
   ASSESSMENT ANALYTICS
========================= */

export type TeacherAssessmentAnalytics = {
  assessment_id: number;
  title: string;
  total_attempts: number;
  unique_students: number;
  average_score: number;
  pass_count: number;
  fail_count: number;
  pass_rate: number;
};

export function getTeacherAssessmentAnalytics() {
  return apiGet<TeacherAssessmentAnalytics[]>(
    "/teacher/analytics/assessments/"
  );
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
  return apiGet<TeacherClassAnalytics[]>(
    "/teacher/analytics/classes/"
  );
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
    `/teacher/analytics/classes/${classId}/students/`
  );
}
