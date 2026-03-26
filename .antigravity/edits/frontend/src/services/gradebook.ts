// services.gradebook
import { apiGet, apiPost, apiPatch, apiDelete } from "./api";

export type GradeTerm =
  | "term_1" | "term_2" | "term_3"
  | "annual" | "monthly" | "other";

export type GradeCategory =
  | "oral" | "practical" | "project" | "classwork"
  | "homework" | "unit_test" | "midterm" | "final" | "other";

export type GradeEntry = {
  id:          number;
  student_id:  number;
  student:     string;
  subject_id:  number;
  subject:     string;
  term:        GradeTerm;
  category:    GradeCategory;
  marks:       number;
  total_marks: number;
  percentage:  number;
  passed:      boolean;
  notes:       string;
  entered_by:  string | null;
  entered_at:  string;
};

export type StudentGrades = {
  student_id: number;
  student:    string;
  entries:    GradeEntry[];
};

export type ClassGradeStudent = {
  student_id: number;
  student:    string;
  username:   string;
  entries:    GradeEntry[];
};

export type ClassGrades = {
  class_id:   number;
  class_name: string;
  students:   ClassGradeStudent[];
};

export type GradeChoices = {
  terms:      { value: GradeTerm;     label: string }[];
  categories: { value: GradeCategory; label: string }[];
};

export type CreateEntryPayload = {
  student_id:  number;
  subject_id:  number;
  marks:       number;
  total_marks: number;
  term?:       GradeTerm;
  category?:   GradeCategory;
  notes?:      string;
};

export type UpdateEntryPayload = Partial<
  Pick<CreateEntryPayload, "marks" | "total_marks" | "term" | "category" | "notes">
>;

export const getGradeChoices = () =>
  apiGet<GradeChoices>("/gradebook/choices/");

export const createGradeEntry = (payload: CreateEntryPayload) =>
  apiPost<GradeEntry>("/gradebook/entry/", payload);

export const updateGradeEntry = (entryId: number, payload: UpdateEntryPayload) =>
  apiPatch<GradeEntry>(`/gradebook/entry/${entryId}/`, payload);

export const deleteGradeEntry = (entryId: number) =>
  apiDelete<{ success: boolean }>(`/gradebook/entry/${entryId}/delete/`);

export const getStudentGrades = (studentId: number, params?: {
  term?: GradeTerm;
  subject_id?: number;
  category?: GradeCategory;
}) => {
  const qs = new URLSearchParams();
  if (params?.term)       qs.set("term",       params.term);
  if (params?.subject_id) qs.set("subject_id", String(params.subject_id));
  if (params?.category)   qs.set("category",   params.category);
  const q = qs.toString() ? `?${qs}` : "";
  return apiGet<StudentGrades>(`/gradebook/student/${studentId}/${q}`);
};

export const getClassGrades = (classId: number, params?: {
  term?: GradeTerm;
  subject_id?: number;
  category?: GradeCategory;
}) => {
  const qs = new URLSearchParams();
  if (params?.term)       qs.set("term",       params.term);
  if (params?.subject_id) qs.set("subject_id", String(params.subject_id));
  if (params?.category)   qs.set("category",   params.category);
  const q = qs.toString() ? `?${qs}` : "";
  return apiGet<ClassGrades>(`/gradebook/class/${classId}/${q}`);
};
