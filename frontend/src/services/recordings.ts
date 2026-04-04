import { apiGet } from "./api";

export interface Recording {
  id: string;
  title: string;
  subject_id: number | null;
  subject_name: string | null;
  teacher_name: string;
  section_id: number;
  section_name: string | null;
  scheduled_at: string;
  started_at: string | null;
  recording_status: "none" | "processing" | "ready" | "failed";
  recording_url: string;
  recording_duration_seconds: number | null;
  recording_size_bytes: number | null;
  recording_r2_key?: string;   // admin debug: R2 object key
  attendance_count?: number;
}


export const recordingsApi = {
  list: async (params?: { subject_id?: number, recording_status?: string }): Promise<Recording[]> => {
    const urlParams = new URLSearchParams();
    if (params?.subject_id) urlParams.append("subject_id", params.subject_id.toString());
    if (params?.recording_status) urlParams.append("recording_status", params.recording_status);
    const query = urlParams.toString() ? `?${urlParams.toString()}` : "";
    
    return await apiGet<Recording[]>(`/live/recordings/${query}`);
  },
  getOne: async (id: string): Promise<Recording> => {
    return await apiGet<Recording>(`/live/recordings/${id}/`);
  }
};
