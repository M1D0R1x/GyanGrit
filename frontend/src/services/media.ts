const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

function getCsrfToken(): string | undefined {
  const match = document.cookie.match(
    new RegExp("(^| )gyangrit_csrftoken=([^;]+)")
  );
  return match ? match[2] : undefined;
}

export type UploadResult = {
  url: string;
  key: string;
  content_type: string;
  size: number;
};

export type UploadFolder = "lessons" | "pdfs" | "images" | "uploads";

/**
 * Upload a file to Cloudflare R2 via the backend.
 * Returns the public URL of the uploaded file.
 */
export async function uploadFile(
  file: File,
  folder: UploadFolder = "uploads",
  onProgress?: (percent: number) => void
): Promise<UploadResult> {
  const csrfToken = getCsrfToken();

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const xhr = new XMLHttpRequest();

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
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    });

    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));

    xhr.open("POST", `${API_BASE_URL}/media/upload/`);
    xhr.withCredentials = true;
    if (csrfToken) {
      xhr.setRequestHeader("X-CSRFToken", csrfToken);
    }

    xhr.send(formData);
  });
}

/**
 * Extract YouTube video ID from various YouTube URL formats.
 */
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

/**
 * Get YouTube thumbnail URL from video ID.
 */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

/**
 * Extract Vimeo video ID from URL.
 */
export function extractVimeoId(url: string): string | null {
  const match = url.match(/vimeo\.com\/(\d+)/);
  return match ? match[1] : null;
}