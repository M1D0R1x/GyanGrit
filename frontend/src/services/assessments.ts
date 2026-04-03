import { apiGet, apiPost, apiPatch } from "./api";

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

// Used in history pages — matches backend response shape
export type AttemptHistoryItem = {
  id: number;
  score: number;
  passed: boolean;
  started_at: string;
  submitted_at: string;
};

// Used in all-history page — includes assessment + subject context
export type AttemptWithContext = {
  id: number;
  score: number;
  passed: boolean;
  submitted_at: string;
  assessment_id: number;
  assessment_title: string;
  total_marks: number;
  pass_marks: number;
  subject: string;
  grade: number;
  course_title: string;
};

export type StartResponse = {
  attempt_id: number;
  assessment_id: number;
  started_at: string;
};

export type AssessmentWithStatus = {
  id: number;
  title: string;
  description: string;
  total_marks: number;
  pass_marks: number;
  course_title: string;
  subject: string;
  grade: number;
  best_score: number | null;
  passed: boolean;
  attempt_count: number | null;
};

export const getCourseAssessments = (courseId: number) =>
  apiGet<AssessmentListItem[]>(`/assessments/course/${courseId}/`);

export const getAssessment = (assessmentId: number) =>
  apiGet<AssessmentDetail>(`/assessments/${assessmentId}/`)

// Admin/Teacher/Principal endpoint — returns is_correct, works on unpublished assessments
export const getAssessmentAdmin = (assessmentId: number) =>
  apiGet<AssessmentDetail>(`/assessments/${assessmentId}/admin/`);

export const startAssessment = (assessmentId: number) =>
  apiPost<StartResponse>(`/assessments/${assessmentId}/start/`, {});

export const submitAssessment = (
  assessmentId: number,
  payload: { attempt_id: number; selected_options: Record<number, number> }
) => apiPost<AttemptResult>(`/assessments/${assessmentId}/submit/`, payload);

export const getMyAttempts = (assessmentId: number) =>
  apiGet<AttemptHistoryItem[]>(`/assessments/${assessmentId}/my-attempts/`);

export const getAllMyAttempts = () =>
  apiGet<AttemptWithContext[]>(`/assessments/my-history/`);

export const updateAssessment = (assessmentId: number, payload: Partial<AssessmentDetail & { is_published: boolean }>) =>
  apiPatch<AssessmentDetail>(`/assessments/${assessmentId}/update/`, payload);