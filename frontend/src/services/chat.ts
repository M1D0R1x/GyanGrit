// services/chat.ts
import { apiGet, apiPost } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────

export type ChatRoom = {
  id:         number;
  section_id: number;
  section:    string;
  class_name: string | null;
  is_active:  boolean;
  created_at: string;
};

export type ChatMessage = {
  id:          number;
  sender_id:   number;
  sender:      string;
  sender_role: string;
  content:     string;
  is_pinned:   boolean;
  sent_at:     string;
};

// ── API calls ─────────────────────────────────────────────────────────────

export const listChatRooms = () =>
  apiGet<ChatRoom[]>("/chat/rooms/");

export const getChatRoomDetail = (roomId: number) =>
  apiGet<ChatRoom>(`/chat/rooms/${roomId}/`);

export const getChatHistory = (roomId: number) =>
  apiGet<ChatMessage[]>(`/chat/rooms/${roomId}/history/`);

export const saveChatMessage = (roomId: number, content: string) =>
  apiPost<ChatMessage>(`/chat/rooms/${roomId}/message/`, { content });

export const pinMessage = (roomId: number, messageId: number) =>
  apiPost<{ id: number; is_pinned: boolean }>(
    `/chat/rooms/${roomId}/pin/${messageId}/`, {}
  );

export const getPinnedMessages = (roomId: number) =>
  apiGet<ChatMessage[]>(`/chat/rooms/${roomId}/pinned/`);
