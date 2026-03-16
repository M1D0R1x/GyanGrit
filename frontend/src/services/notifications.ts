// services.notifications
import { apiGet, apiPost } from "./api";

// ── Types ─────────────────────────────────────────────────────────────────

export type NotificationType =
  | "info"
  | "success"
  | "warning"
  | "error"
  | "announcement"
  | "assessment"
  | "lesson";

export type AudienceType =
  | "direct"
  | "class_all"
  | "class_students"
  | "class_teachers"
  | "school_all"
  | "school_students"
  | "school_teachers"
  | "district_all"
  | "district_students"
  | "district_teachers"
  | "district_principals"
  | "system";

export const AUDIENCE_LABELS: Record<AudienceType, string> = {
  direct:               "Direct (single user)",
  class_all:            "Entire class",
  class_students:       "Class — students only",
  class_teachers:       "Class — teachers only",
  school_all:           "Whole school",
  school_students:      "School — students only",
  school_teachers:      "School — teachers only",
  district_all:         "Entire district",
  district_students:    "District — students only",
  district_teachers:    "District — teachers only",
  district_principals:  "District — principals only",
  system:               "System-wide",
};

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  info:         "Info",
  success:      "Success",
  warning:      "Warning",
  error:        "Error",
  announcement: "Announcement",
  assessment:   "Assessment",
  lesson:       "Lesson",
};

export type AppNotification = {
  id:              number;
  subject:         string;
  message:         string;
  type:            NotificationType;
  is_read:         boolean;
  link:            string;
  attachment_url:  string;
  attachment_name: string;
  created_at:      string;
  sender:          string;
};

export type NotificationInbox = {
  unread:        number;
  notifications: AppNotification[];
};

export type Broadcast = {
  id:                number;
  subject:           string;
  message:           string;
  notification_type: NotificationType;
  audience_type:     AudienceType;
  audience_label:    string;
  link:              string;
  attachment_url:    string;
  attachment_name:   string;
  sent_at:           string;
  recipient_count:   number;
};

export type BroadcastDetail = Broadcast & {
  read_count:   number;
  unread_count: number;
  recipients: {
    user_id:  number;
    username: string;
    is_read:  boolean;
  }[];
};

export type SentHistoryResponse = {
  count:       number;
  page:        number;
  total_pages: number;
  results:     Broadcast[];
};

export type AudienceOptions = {
  allowed_audience_types: AudienceType[];
  classrooms: {
    id:               number;
    name:             string;
    institution__name: string;
  }[];
  institutions: {
    id:   number;
    name: string;
  }[];
};

export type SendPayload = {
  subject:           string;
  message?:          string;
  notification_type?: NotificationType;
  audience_type:     AudienceType;
  class_id?:         number;
  institution_id?:   number;
  link?:             string;
  attachment_url?:   string;
  attachment_name?:  string;
};

export type SendResult = {
  success:         boolean;
  broadcast_id:    number;
  recipient_count: number;
  audience_label:  string;
};

// ── Service functions ─────────────────────────────────────────────────────

export const fetchNotifications = (params?: {
  type?: NotificationType;
  unread_only?: boolean;
}) => {
  const qs = new URLSearchParams();
  if (params?.type)         qs.set("type", params.type);
  if (params?.unread_only)  qs.set("unread_only", "1");
  const query = qs.toString() ? `?${qs}` : "";
  return apiGet<NotificationInbox>(`/notifications/${query}`);
};

export const markRead = (id: number) =>
  apiPost<{ success: boolean }>(`/notifications/${id}/read/`, {});

export const markAllRead = () =>
  apiPost<{ success: boolean; marked: number }>("/notifications/read-all/", {});

export const sendNotification = (payload: SendPayload) =>
  apiPost<SendResult>("/notifications/send/", payload);

export const getSentHistory = (params?: {
  q?:     string;
  type?:  NotificationType;
  from?:  string;
  to?:    string;
  page?:  number;
}) => {
  const qs = new URLSearchParams();
  if (params?.q)    qs.set("q", params.q);
  if (params?.type) qs.set("type", params.type);
  if (params?.from) qs.set("from", params.from);
  if (params?.to)   qs.set("to", params.to);
  if (params?.page) qs.set("page", String(params.page));
  const query = qs.toString() ? `?${qs}` : "";
  return apiGet<SentHistoryResponse>(`/notifications/sent/${query}`);
};

export const getBroadcastDetail = (id: number) =>
  apiGet<BroadcastDetail>(`/notifications/sent/${id}/`);

export const getAudienceOptions = () =>
  apiGet<AudienceOptions>("/notifications/audience-options/");