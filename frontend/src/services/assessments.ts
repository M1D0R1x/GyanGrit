import { apiGet, apiPost } from "./api";

export type AssessmentListItem = {
  id: number;
  title: string;
  description: string;
  total_marks: number;
  pass_marks: number;
};

export type AssessmentQuestion = {
  id: number;
  text: string;
  marks: number;
  order: number;
  options: { id: number; text: string }[];
};

export type AssessmentDetail = {
  id: number;
  title: string;
  description: string;
  total_marks: number;
  pass_marks: number;
  questions: AssessmentQuestion[];
};

export type AttemptResult = {
  attempt_id: number;
  score: number;
  passed: boolean;
  total_marks: number;
  pass_marks: number;
};

export type MyAttempt = {
  id: number;
  score: number;
  passed: boolean;
  started_at: string;
  submitted_at: string;
};

export type StartResponse = {
  attempt_id: number;
  assessment_id: number;
  started_at: string;
};

// Course assessments list
export const getCourseAssessments = (courseId: number) =>
  apiGet<AssessmentListItem[]>(`/assessments/course/${courseId}/`);

// Full assessment with questions (no is_correct)
export const getAssessment = (assessmentId: number) =>
  apiGet<AssessmentDetail>(`/assessments/${assessmentId}/`);

// Start or resume attempt
export const startAssessment = (assessmentId: number) =>
  apiPost<StartResponse>(`/assessments/${assessmentId}/start/`, {});

// Submit answers
export const submitAssessment = (
  assessmentId: number,
  payload: { attempt_id: number; selected_options: Record<number, number> }
) => apiPost<AttemptResult>(`/assessments/${assessmentId}/submit/`, payload);

// My attempt history for one assessment
export const getMyAttempts = (assessmentId: number) =>
  apiGet<MyAttempt[]>(`/assessments/${assessmentId}/my-attempts/`);