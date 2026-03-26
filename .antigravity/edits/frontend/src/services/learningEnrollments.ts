import { apiGet, apiPost, apiPatch } from "./api";

/**
 * Enrollment record.
 *
 * NOTE:
 * - Status values MUST match backend exactly (lowercase)
 */
export type Enrollment = {
  id: number;
  course__id: number;
  course__title: string;
  status: "enrolled" | "completed" | "dropped";
};

/**
 * Fetch all enrollments for the current learner.
 */
export function getEnrollments() {
  return apiGet<Enrollment[]>("/learning/enrollments/");
}

/**
 * Enroll into a course.
 *
 * Rules:
 * - Always go through api.ts
 * - Never hardcode base URL
 * - Session + CSRF safe
 */
export function enrollCourse(courseId: number) {
  return apiPost("/learning/enroll/", {
    course_id: courseId,
  });
}

/**
 * Update enrollment status.
 */
export function updateEnrollment(
  enrollmentId: number,
  status: "completed" | "dropped"
) {
  return apiPatch(
    `/learning/enrollments/${enrollmentId}/`,
    { status }
  );
}
