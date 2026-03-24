// services/flashcards.ts
import { apiGet, apiPost, apiPatch, apiDelete } from "./api";

export type FlashcardDeck = {
  id:           number;
  title:        string;
  description:  string;
  subject_id:   number;
  subject_name: string;
  section_id:   number | null;
  is_published: boolean;
  card_count:   number;
  due_count?:   number;
  created_at:   string;
  created_by:   string;
};

export type Flashcard = {
  id:    number;
  front: string;
  back:  string;
  hint:  string;
  order: number;
  progress?: {
    repetitions:   number;
    ease_factor:   number;
    interval:      number;
    next_review:   string;
    total_reviews: number;
    correct_count: number;
  } | null;
};

export type DeckDetail = FlashcardDeck & { cards: Flashcard[] };

export type DueSession = {
  deck_id:    number;
  deck_title: string;
  total_due:  number;
  cards:      Flashcard[];
};

export type DeckStats = {
  deck_id:       number;
  total_cards:   number;
  reviewed:      number;
  new:           number;
  mastered:      number;
  due_today:     number;
  total_reviews: number;
};

// Teacher
export const listMyDecks   = ()                => apiGet<FlashcardDeck[]>("/flashcards/decks/");
export const getDeck       = (id: number)      => apiGet<DeckDetail>(`/flashcards/decks/${id}/`);
export const createDeck    = (body: { title: string; description?: string; subject_id: number; section_id?: number }) =>
  apiPost<DeckDetail>("/flashcards/decks/", body);
export const updateDeck    = (id: number, body: Partial<{ title: string; description: string; is_published: boolean }>) =>
  apiPatch<DeckDetail>(`/flashcards/decks/${id}/`, body);
export const deleteDeck    = (id: number)      => apiDelete(`/flashcards/decks/${id}/`);
export const createCard    = (deckId: number, body: { front: string; back: string; hint?: string }) =>
  apiPost<Flashcard>(`/flashcards/decks/${deckId}/cards/`, body);
export const updateCard    = (deckId: number, cardId: number, body: Partial<Flashcard>) =>
  apiPatch<Flashcard>(`/flashcards/decks/${deckId}/cards/${cardId}/`, body);
export const deleteCard    = (deckId: number, cardId: number) =>
  apiDelete(`/flashcards/decks/${deckId}/cards/${cardId}/`);

// Student
export const listStudyDecks = () => apiGet<FlashcardDeck[]>("/flashcards/study/");
export const getDueCards    = (deckId: number) => apiGet<DueSession>(`/flashcards/study/${deckId}/due/`);
export const submitReview   = (deckId: number, cardId: number, quality: number) =>
  apiPost<{ card_id: number; next_review: string; interval: number; repetitions: number; ease_factor: number }>(
    `/flashcards/study/${deckId}/review/`,
    { card_id: cardId, quality },
  );
export const getDeckStats   = (deckId: number) => apiGet<DeckStats>(`/flashcards/study/${deckId}/stats/`);
