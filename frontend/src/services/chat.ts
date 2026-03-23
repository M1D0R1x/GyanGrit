// services/chat.ts
import { apiGet, apiPost } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────

export type RoomType = "class_general" | "subject" | "staff" | "officials";

export type ChatRoom = {
  id:             number;
  name:           string;
  room_type:      RoomType;
  section_id:     number | null;
  subject_id:     number | null;
  institution_id: number | null;
  is_active:      boolean;
  ably_channel:   string;
};

export type ChatMessage = {
  id:              number;
  sender_id:       number;
  sender_name:     string;   // "First Last" or "Chat Moderator" for ADMIN
  sender_role:     string;   // raw role e.g. "TEACHER"
  role_label:      string;   // "teacher" | "student" | "moderator" | ...
  content:         string;
  attachment_url:  string | null;
  attachment_type: "image" | "file" | null;
  attachment_name: string | null;
  parent_id:       number | null;
  reply_count:     number;
  is_pinned:       boolean;
  sent_at:         string;
};

export type ThreadResponse = {
  parent:  ChatMessage;
  replies: ChatMessage[];
};

// ── API calls ─────────────────────────────────────────────────────────────

/** List rooms. Admin can filter by institution_id or room_type via query params. */
export const listChatRooms = (institutionId?: string) => {
  const q = institutionId ? `?institution_id=${institutionId}` : "";
  return apiGet<ChatRoom[]>(`/chat/rooms/${q}`);
};

export const getChatRoomDetail = (roomId: number) =>
  apiGet<ChatRoom>(`/chat/rooms/${roomId}/`);

/** Last 50 top-level messages (parent_id = null) with reply_count each. */
export const getChatHistory = (roomId: number) =>
  apiGet<ChatMessage[]>(`/chat/rooms/${roomId}/history/`);

/** Get a message + all its replies (thread view). */
export const getChatThread = (roomId: number, messageId: number) =>
  apiGet<ThreadResponse>(`/chat/rooms/${roomId}/thread/${messageId}/`);

/** Send a message. parentId = undefined means top-level, set = reply. */
export const saveChatMessage = (
  roomId: number,
  content: string,
  parentId?: number,
  attachmentUrl?: string,
  attachmentType?: "image" | "file",
  attachmentName?: string,
) =>
  apiPost<ChatMessage>(`/chat/rooms/${roomId}/message/`, {
    content,
    ...(parentId       ? { parent_id: parentId }             : {}),
    ...(attachmentUrl  ? { attachment_url: attachmentUrl }   : {}),
    ...(attachmentType ? { attachment_type: attachmentType } : {}),
    ...(attachmentName ? { attachment_name: attachmentName } : {}),
  });

export const pinMessage = (roomId: number, messageId: number) =>
  apiPost<{ id: number; is_pinned: boolean }>(
    `/chat/rooms/${roomId}/pin/${messageId}/`, {}
  );

export const getPinnedMessages = (roomId: number) =>
  apiGet<ChatMessage[]>(`/chat/rooms/${roomId}/pinned/`);
