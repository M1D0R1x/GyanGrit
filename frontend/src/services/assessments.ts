import { apiGet, apiPost } from "./api";

/* =========================
   Types
========================= */

export type AssessmentListItem = {
  id: number;
  title: string;
  description: string;
  total_marks: number;
  pass_marks: number;
};

export type AssessmentDetail = {
  id: number;
  title: string;
  description: string;
  total_marks: number;
  pass_marks: number;
  questions: {
    id: number;
    text: string;
    marks: number;
    options: {
      id: number;
      text: string;
    }[];
  }[];
};

export type AttemptHistoryItem = {
  id: number;
  score: number;
  passed: boolean;
  started_at: string;
  submitted_at: string;
};

/* =========================
   API Calls
========================= */

export function getCourseAssessments(courseId: number) {
  return apiGet<AssessmentListItem[]>(
    `/assessments/course/${courseId}/`
  );
}

export function getAssessment(assessmentId: number) {
  return apiGet<AssessmentDetail>(
    `/assessments/${assessmentId}/`
  );
}

export function startAssessment(assessmentId: number) {
  return apiPost(
    `/assessments/${assessmentId}/start/`,
    {}
  );
}

export function submitAssessment(
  assessmentId: number,
  payload: {
    attempt_id: number;
    answers: Record<number, number>;
  }
) {
  return apiPost(
    `/assessments/${assessmentId}/submit/`,
    payload
  );
}

export function getMyAttempts(assessmentId: number) {
  return apiGet<AttemptHistoryItem[]>(
    `/assessments/${assessmentId}/my-attempts/`
  );
}
