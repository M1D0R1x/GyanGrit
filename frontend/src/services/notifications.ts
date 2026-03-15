import { apiGet, apiPost } from "./api";

export type NotificationType = "info" | "success" | "warning" | "error";

export type AppNotification = {
  id: number;
  title: string;
  message: string;
  type: NotificationType;
  is_read: boolean;
  link: string;
  created_at: string;
};

export type NotificationsResponse = {
  unread: number;
  notifications: AppNotification[];
};

export function fetchNotifications(): Promise<NotificationsResponse> {
  return apiGet<NotificationsResponse>("/notifications/");
}

export function markRead(id: number): Promise<void> {
  return apiPost(`/notifications/${id}/read/`, {}).then(() => undefined);
}

export function markAllRead(): Promise<void> {
  return apiPost("/notifications/read-all/", {}).then(() => undefined);
}