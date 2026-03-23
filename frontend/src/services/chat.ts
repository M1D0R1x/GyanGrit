// services/chat.ts
import { apiGet, apiPost } from "./api";

export type RoomType = "subject" | "staff" | "officials";

export type ChatRoom = {
  id:             number;
  name:           string;
  room_type:      RoomType;
  section_id:     number | null;
  subject_id:     number | null;
  institution_id: number | null;
  is_active:      boolean;
  ably_channel:   string;
  member_count?:  number;
};

export type ChatMessage = {
  id:              number;
  sender_id:       number;
  sender_name:     string;
  sender_role:     string;
  role_label:      string;
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

export type RoomMember = {
  user_id:    number;
  name:       string;
  role:       string;
  role_label: string;
  joined_at:  string;
};

// User-facing
export const listChatRooms = (institutionId?: string) =>
  apiGet<ChatRoom[]>(`/chat/rooms/${institutionId ? `?institution_id=${institutionId}` : ""}`);

export const getChatRoomDetail = (roomId: number) =>
  apiGet<ChatRoom>(`/chat/rooms/${roomId}/`);

export const getChatHistory = (roomId: number) =>
  apiGet<ChatMessage[]>(`/chat/rooms/${roomId}/history/`);

export const getChatThread = (roomId: number, messageId: number) =>
  apiGet<ThreadResponse>(`/chat/rooms/${roomId}/thread/${messageId}/`);

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
    ...(parentId       ? { parent_id:       parentId       } : {}),
    ...(attachmentUrl  ? { attachment_url:  attachmentUrl  } : {}),
    ...(attachmentType ? { attachment_type: attachmentType } : {}),
    ...(attachmentName ? { attachment_name: attachmentName } : {}),
  });

export const pinMessage = (roomId: number, messageId: number) =>
  apiPost<{ id: number; is_pinned: boolean }>(`/chat/rooms/${roomId}/pin/${messageId}/`, {});

export const getPinnedMessages = (roomId: number) =>
  apiGet<ChatMessage[]>(`/chat/rooms/${roomId}/pinned/`);

export const getRoomMembers = (roomId: number) =>
  apiGet<RoomMember[]>(`/chat/rooms/${roomId}/members/`);

// Admin
export const adminListRooms = (params?: { institution_id?: string; room_type?: string; q?: string }) => {
  const qs = params ? "?" + new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, v]) => v)) as Record<string, string>
  ).toString() : "";
  return apiGet<(ChatRoom & { message_count: number; institution_name: string | null })[]>(
    `/chat/admin/rooms/${qs}`
  );
};

export const adminGetRoomMessages = (roomId: number) =>
  apiGet<{ room: ChatRoom; messages: ChatMessage[] }>(`/chat/admin/rooms/${roomId}/messages/`);
