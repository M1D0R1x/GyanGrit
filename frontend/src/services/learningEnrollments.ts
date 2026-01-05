import { apiGet, apiPatch } from "./api";

/**
 * Enrollment record.
 */
export type Enrollment = {
  id: number;
  course__id: number;
  course__title: string;
  status: "ENROLLED" | "COMPLETED" | "DROPPED";
};

/**
 * Fetch all enrollments for the current learner.
 */
export function getEnrollments() {
  return apiGet<Enrollment[]>("/learning/enrollments/");
}

/**
 * Enroll into a course.
 */
export function enrollCourse(courseId: number) {
  return fetch("http://127.0.0.1:8000/api/v1/learning/enroll/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ course_id: courseId }),
  }).then((res) => {
    if (!res.ok) {
      throw new Error("Failed to enroll");
    }
    return res.json();
  });
}

/**
 * Update enrollment status.
 */
export function updateEnrollment(
  enrollmentId: number,
  status: "COMPLETED" | "DROPPED"
) {
  return apiPatch(`/learning/enrollments/${enrollmentId}/`, { status });
}
