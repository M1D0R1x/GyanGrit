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
    order: number;
    options: {
      id: number;
      text: string;
      // is_correct is intentionally absent — never sent to client
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

export type SubmitAssessmentPayload = {
  attempt_id: number;
  // Field name matches backend exactly: selected_options not answers
  selected_options: Record<number, number>;
};

export type SubmitAssessmentResponse = {
  attempt_id: number;
  score: number;
  passed: boolean;
  total_marks: number;
  pass_marks: number;
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
  return apiPost<{
    attempt_id: number;
    assessment_id: number;
    started_at: string;
  }>(
    `/assessments/${assessmentId}/start/`,
    {}
  );
}

export function submitAssessment(
  assessmentId: number,
  payload: SubmitAssessmentPayload
) {
  return apiPost<SubmitAssessmentResponse>(
    `/assessments/${assessmentId}/submit/`,
    payload
  );
}

export function getMyAttempts(assessmentId: number) {
  return apiGet<AttemptHistoryItem[]>(
    `/assessments/${assessmentId}/my-attempts/`
  );
}