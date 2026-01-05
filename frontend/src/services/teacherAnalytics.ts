import { apiGet } from "./api";

/**
 * Course-level analytics for teachers.
 */
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

/**
 * Lesson-level analytics for teachers.
 */
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
