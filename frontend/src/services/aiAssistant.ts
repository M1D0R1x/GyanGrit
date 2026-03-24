// services/aiAssistant.ts
import { apiGet, apiPost, apiDelete } from "./api";

export type Conversation = {
  id:            number;
  subject_id:    number | null;
  subject_name:  string;
  started_at:    string;
  updated_at:    string;
  message_count: number;
};

export type AIMessage = {
  id:         number;
  role:       "user" | "assistant";
  content:    string;
  created_at: string;
};

export type ConversationDetail = {
  id:           number;
  subject_id:   number | null;
  subject_name: string;
  messages:     AIMessage[];
};

export type ChatResponse = {
  conversation_id: number;
  message:         AIMessage;
};

export const listConversations = () =>
  apiGet<Conversation[]>("/ai/conversations/");

export const getConversation = (id: number) =>
  apiGet<ConversationDetail>(`/ai/conversations/${id}/`);

export const sendMessage = (body: {
  message: string;
  conversation_id?: number;
  subject_id?: number;
}) => apiPost<ChatResponse>("/ai/chat/", body);

export const deleteConversation = (id: number) =>
  apiDelete(`/ai/conversations/${id}/delete/`);
