// services/aiTools.ts
import { apiPost } from "./api";
import type { Flashcard } from "./flashcards";
import type { AssessmentQuestion } from "./assessments";

// ── AI Generated Flashcards ──────────────────────────────────────────────────

export type AIFlashcardGenerateRequest = {
  lesson_id?: number;
  text?: string;
  subject_id?: number;
  section_id?: number;
  count?: number;
};

export type AIFlashcardGenerateResponse = {
  deck_id: number;
  title: string;
  status: "draft" | "published";
  ai_generated: boolean;
  cards: Flashcard[];
  message: string;
};

export const generateAIFlashcards = (body: AIFlashcardGenerateRequest) =>
  apiPost<AIFlashcardGenerateResponse>("/flashcards/ai-generate/", body);

export const publishAIFlashcardDeck = (deckId: number) =>
  apiPost<{ deck_id: number; status: string; published: boolean }>(
    `/flashcards/ai-generate/${deckId}/publish/`,
    {}
  );


// ── AI Generated Assessments ────────────────────────────────────────────────

export type AIAssessmentGenerateRequest = {
  lesson_id?: number;
  text?: string;
  count?: number;
  marks_per_question?: number;
  pass_percent?: number;
};

export type AIAssessmentGenerateResponse = {
  assessment_id: number;
  title: string;
  status: "draft" | "published";
  ai_generated: boolean;
  total_marks: number;
  pass_marks: number;
  questions: (Omit<AssessmentQuestion, "options"> & { options: { text: string; is_correct: boolean }[] })[];
  message: string;
};

export const generateAIAssessment = (courseId: number, body: AIAssessmentGenerateRequest) =>
  apiPost<AIAssessmentGenerateResponse>(`/assessments/course/${courseId}/ai-generate/`, body);

// Note: To publish an assessment, use updateAssessment from assessments.ts with { is_published: true }
