// services.media
/**
 * media.ts — Cloudflare R2 file upload service.
 *
 * RULES (enforced by project):
 * - Never hardcode base URLs — import API_BASE_URL from api.ts
 * - Upload uses XHR (not fetch) to support upload progress callbacks
 * - CSRF token read from gyangrit_csrftoken cookie
 * - credentials: "include" equivalent is xhr.withCredentials = true
 */

import { API_BASE_URL } from "./api";

function getCsrfToken(): string | undefined {
  const match = document.cookie.match(
    new RegExp("(^| )gyangrit_csrftoken=([^;]+)")
  );
  return match ? match[2] : undefined;
}

export type UploadResult = {
  url:          string;
  key:          string;
  display_name: string;  // human-readable name stored in DB
  content_type: string;
  size:         number;
};

export type UploadFolder =
  | "lessons"
  | "pdfs"
  | "images"
  | "uploads"
  | "videos"
  | "notification-files";

// Allowed MIME types for notification attachments (must match r2.py ALLOWED_TYPES)
export const NOTIFICATION_ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",       // xlsx
  "application/msword",      // .doc
  "application/vnd.ms-excel", // .xls
] as const;

export const NOTIFICATION_MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// Human-readable label for the allowed types (shown in file picker UI)
export const NOTIFICATION_ALLOWED_EXTENSIONS = ".pdf,.docx,.xlsx,.doc,.xls,.jpg,.jpeg,.png,.webp";

/**
 * Upload a file to Cloudflare R2 via the backend.
 *
 * Uses XHR instead of fetch to support real upload progress reporting.
 * Passes display_name so the R2 key uses the human-readable filename.
 *
 * @param file         The File object to upload
 * @param folder       Subfolder in R2 (e.g. "notification-files")
 * @param displayName  Human-readable name to store and use as key base.
 *                     Defaults to file.name if not provided.
 * @param onProgress   Optional callback receiving 0–100 percent complete
 * @param signal       Optional AbortSignal — aborting cancels the XHR
 */
export function uploadFile(
  file: File,
  folder: UploadFolder = "uploads",
  displayName?: string,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  const csrfToken = getCsrfToken();

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);
    if (displayName) {
      formData.append("display_name", displayName);
    }

    const xhr = new XMLHttpRequest();

    // Wire AbortSignal to XHR abort
    if (signal) {
      if (signal.aborted) {
        reject(new DOMException("Upload aborted", "AbortError"));
        return;
      }
      signal.addEventListener("abort", () => {
        xhr.abort();
        reject(new DOMException("Upload aborted", "AbortError"));
      });
    }

    if (onProgress) {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as UploadResult);
        } catch {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText) as { error?: string };
          reject(new Error(err.error ?? `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () =>
      reject(new Error("Network error during upload"))
    );

    xhr.open("POST", `${API_BASE_URL}/media/upload/`);
    xhr.withCredentials = true;
    if (csrfToken) {
      xhr.setRequestHeader("X-CSRFToken", csrfToken);
    }

    xhr.send(formData);
  });
}

/**
 * Upload a notification attachment to the "notification-files" folder.
 *
 * Validates file type and size client-side before uploading.
 * Uses the file's own name as the display name unless overridden.
 *
 * @throws Error with human-readable message if validation fails
 */
export async function uploadNotificationFile(
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  // Client-side validation (mirrored from server — server is the real guard)
  if (!NOTIFICATION_ALLOWED_TYPES.includes(file.type as typeof NOTIFICATION_ALLOWED_TYPES[number])) {
    throw new Error(
      `File type "${file.type || "unknown"}" is not allowed. ` +
      "Upload PDF, Word, Excel, or image files only."
    );
  }

  if (file.size > NOTIFICATION_MAX_SIZE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`File is ${mb} MB. Maximum size for notification attachments is 10 MB.`);
  }

  return uploadFile(
    file,
    "notification-files",
    file.name,       // display_name = original filename → "holiday notice.pdf"
    onProgress,
    signal,
  );
}

// ── YouTube / Vimeo helpers (unchanged) ──────────────────────────────────────

export function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}