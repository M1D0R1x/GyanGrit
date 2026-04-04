// services/offline.ts
/**
 * Offline content storage using IndexedDB (v2 — full offline-first)
 *
 * Stores:
 *   - Lesson text/markdown content
 *   - Flashcard decks with all card data
 *   - PDF blobs (stored as ArrayBuffer)
 *   - Video blobs (stored as ArrayBuffer — low-res only)
 *   - Assessment data (questions + options, no answers)
 *   - Offline action queue (completed lessons, flashcard reviews, etc.)
 *
 * CORS FIX:
 *   R2 videos/PDFs are fetched through /api/v1/media-proxy/?url=... so the
 *   browser never attempts a cross-origin fetch directly to r2.dev.
 */
import { API_BASE_URL } from "./api";

const DB_NAME = "gyangrit-offline";
const DB_VERSION = 2; // bumped from v1 — adds new stores
const LESSON_STORE = "lessons";
const FLASHCARD_STORE = "flashcards";
const PDF_STORE = "pdfs";
const VIDEO_STORE = "videos";
const QUEUE_STORE = "offline_queue";
const ASSESSMENT_STORE = "assessments";
const META_STORE = "meta"; // general metadata / settings

// ── IndexedDB setup ──────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // v1 stores
      if (oldVersion < 1) {
        const lessonStore = db.createObjectStore(LESSON_STORE, { keyPath: "id" });
        lessonStore.createIndex("courseId", "courseId", { unique: false });

        const flashcardStore = db.createObjectStore(FLASHCARD_STORE, { keyPath: "deckId" });
        flashcardStore.createIndex("subjectId", "subjectId", { unique: false });
      }

      // v2 stores — new for offline-first
      if (oldVersion < 2) {
        const pdfStore = db.createObjectStore(PDF_STORE, { keyPath: "id" });
        pdfStore.createIndex("lessonId", "lessonId", { unique: false });

        const videoStore = db.createObjectStore(VIDEO_STORE, { keyPath: "id" });
        videoStore.createIndex("lessonId", "lessonId", { unique: false });

        const queueStore = db.createObjectStore(QUEUE_STORE, {
          keyPath: "queueId",
          autoIncrement: true,
        });
        queueStore.createIndex("type", "type", { unique: false });
        queueStore.createIndex("synced", "synced", { unique: false });

        const assessmentStore = db.createObjectStore(ASSESSMENT_STORE, { keyPath: "id" });
        assessmentStore.createIndex("courseId", "courseId", { unique: false });

        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── Generic helpers ──────────────────────────────────────────────────────────

async function putItem(storeName: string, item: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getItem<T>(storeName: string, key: number | string): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result as T | undefined); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function getAllByIndex<T>(storeName: string, indexName: string, value: number | string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const index = tx.objectStore(storeName).index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => { db.close(); resolve(req.result as T[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function deleteItem(storeName: string, key: number | string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getAllKeys(storeName: string): Promise<(number | string)[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAllKeys();
    req.onsuccess = () => { db.close(); resolve(req.result as (number | string)[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => { db.close(); resolve(req.result as T[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function clearStore(storeName: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ── Types ────────────────────────────────────────────────────────────────────

export type OfflineLesson = {
  id: number;
  courseId: number;
  courseTitle?: string;
  subjectName?: string;
  grade?: number;
  title: string;
  content: string;
  pdfUrl: string;
  videoUrl: string;
  order: number;
  savedAt: string; // ISO timestamp
};

export type OfflineFlashcardDeck = {
  deckId: number;
  subjectId: number;
  title: string;
  cards: { id: number; front: string; back: string; hint: string }[];
  savedAt: string;
};

export type OfflinePdf = {
  id: string;        // "pdf_{lessonId}"
  lessonId: number;
  fileName: string;
  data: ArrayBuffer;
  size: number;       // bytes
  savedAt: string;
};

export type OfflineVideo = {
  id: string;        // "vid_{lessonId}"
  lessonId: number;
  fileName: string;
  data: ArrayBuffer;
  size: number;       // bytes
  mimeType: string;
  savedAt: string;
};

export type OfflineAssessment = {
  id: number;
  courseId: number;
  title: string;
  totalMarks: number;
  passMarks: number;
  questions: {
    id: number;
    text: string;
    marks: number;
    order: number;
    options: { id: number; text: string }[]; // no is_correct — never stored offline
  }[];
  savedAt: string;
};

export type OfflineQueueItem = {
  queueId?: number;     // auto-increment
  type: "lesson_complete" | "flashcard_review" | "assessment_submit" | "lesson_progress";
  payload: Record<string, unknown>;
  createdAt: string;
  synced: 0 | 1;       // 0 = pending, 1 = synced (indexed)
  syncedAt?: string;
  retryCount: number;
};

// ── Public API: Lessons ──────────────────────────────────────────────────────

export async function saveLessonOffline(lesson: OfflineLesson): Promise<void> {
  await putItem(LESSON_STORE, lesson);
}

export async function getOfflineLesson(lessonId: number): Promise<OfflineLesson | undefined> {
  return getItem<OfflineLesson>(LESSON_STORE, lessonId);
}

export async function getOfflineLessonsByCourse(courseId: number): Promise<OfflineLesson[]> {
  return getAllByIndex<OfflineLesson>(LESSON_STORE, "courseId", courseId);
}

export async function getAllOfflineLessons(): Promise<OfflineLesson[]> {
  return getAll<OfflineLesson>(LESSON_STORE);
}

export async function removeOfflineLesson(lessonId: number): Promise<void> {
  await deleteItem(LESSON_STORE, lessonId);
  // Also clean up associated PDF and video blobs
  await deleteItem(PDF_STORE, `pdf_${lessonId}`).catch(() => {});
  await deleteItem(VIDEO_STORE, `vid_${lessonId}`).catch(() => {});
}

export async function getSavedLessonIds(): Promise<number[]> {
  return (await getAllKeys(LESSON_STORE)) as number[];
}

export async function isLessonSavedOffline(lessonId: number): Promise<boolean> {
  const lesson = await getItem<OfflineLesson>(LESSON_STORE, lessonId);
  return lesson !== undefined;
}

// ── Media proxy URL builder ──────────────────────────────────────────────────
// Routes R2 fetches through the backend to bypass CORS.
function toProxyUrl(mediaUrl: string): string {
  return `${API_BASE_URL}/media-proxy/?url=${encodeURIComponent(mediaUrl)}`;
}

// ── Public API: PDFs ─────────────────────────────────────────────────────────

export async function savePdfOffline(lessonId: number, url: string): Promise<void> {
  const proxyUrl = toProxyUrl(url);
  const response = await fetch(proxyUrl, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to download PDF: ${response.status}`);
  const data = await response.arrayBuffer();
  const fileName = url.split("/").pop() || `lesson_${lessonId}.pdf`;
  await putItem(PDF_STORE, {
    id: `pdf_${lessonId}`,
    lessonId,
    fileName,
    data,
    size: data.byteLength,
    savedAt: new Date().toISOString(),
  } as OfflinePdf);
}

export async function getOfflinePdf(lessonId: number): Promise<OfflinePdf | undefined> {
  return getItem<OfflinePdf>(PDF_STORE, `pdf_${lessonId}`);
}

export async function isPdfSavedOffline(lessonId: number): Promise<boolean> {
  const pdf = await getItem<OfflinePdf>(PDF_STORE, `pdf_${lessonId}`);
  return pdf !== undefined;
}

export async function getAllOfflinePdfs(): Promise<OfflinePdf[]> {
  return getAll<OfflinePdf>(PDF_STORE);
}

export async function removeOfflinePdf(id: string): Promise<void> {
  return deleteItem(PDF_STORE, id);
}

export function createPdfBlobUrl(pdf: OfflinePdf): string {
  const blob = new Blob([pdf.data], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

// ── Public API: Videos ───────────────────────────────────────────────────────

export async function saveVideoOffline(
  lessonId: number,
  url: string,
  onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
  // Check storage before downloading large file
  const estimate = await getStorageEstimate();
  if (estimate.percentUsed > 90) {
    throw new Error("Storage almost full. Please remove some downloaded content first.");
  }

  // Route through backend proxy to avoid R2 CORS block
  const proxyUrl = toProxyUrl(url);
  const response = await fetch(proxyUrl, { credentials: "include", cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to download video: ${response.status}`);

  const contentLength = Number(response.headers.get("content-length") || 0);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming not supported");

  const chunks: Uint8Array[] = [];
  let downloaded = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    downloaded += value.length;
    onProgress?.(downloaded, contentLength);
  }

  // Combine chunks into a single ArrayBuffer
  const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }

  const fileName = url.split("/").pop() || `lesson_${lessonId}.mp4`;
  const mimeType = url.includes(".webm") ? "video/webm" : "video/mp4";

  await putItem(VIDEO_STORE, {
    id: `vid_${lessonId}`,
    lessonId,
    fileName,
    data: combined.buffer,
    size: combined.byteLength,
    mimeType,
    savedAt: new Date().toISOString(),
  } as OfflineVideo);
}

export async function getOfflineVideo(lessonId: number): Promise<OfflineVideo | undefined> {
  return getItem<OfflineVideo>(VIDEO_STORE, `vid_${lessonId}`);
}

export async function isVideoSavedOffline(lessonId: number): Promise<boolean> {
  const video = await getItem<OfflineVideo>(VIDEO_STORE, `vid_${lessonId}`);
  return video !== undefined;
}

export async function getAllOfflineVideos(): Promise<OfflineVideo[]> {
  return getAll<OfflineVideo>(VIDEO_STORE);
}

export async function removeOfflineVideo(id: string): Promise<void> {
  return deleteItem(VIDEO_STORE, id);
}

export function createVideoBlobUrl(video: OfflineVideo): string {
  const blob = new Blob([video.data], { type: video.mimeType });
  return URL.createObjectURL(blob);
}

// ── Public API: Flashcards ───────────────────────────────────────────────────

export async function saveFlashcardDeckOffline(deck: OfflineFlashcardDeck): Promise<void> {
  await putItem(FLASHCARD_STORE, deck);
}

export async function getOfflineFlashcardDeck(deckId: number): Promise<OfflineFlashcardDeck | undefined> {
  return getItem<OfflineFlashcardDeck>(FLASHCARD_STORE, deckId);
}

export async function getAllOfflineDecks(): Promise<OfflineFlashcardDeck[]> {
  return getAll<OfflineFlashcardDeck>(FLASHCARD_STORE);
}

export async function removeOfflineFlashcardDeck(deckId: number): Promise<void> {
  await deleteItem(FLASHCARD_STORE, deckId);
}

export async function getSavedDeckIds(): Promise<number[]> {
  return (await getAllKeys(FLASHCARD_STORE)) as number[];
}

// ── Public API: Assessments ──────────────────────────────────────────────────

export async function saveAssessmentOffline(assessment: OfflineAssessment): Promise<void> {
  await putItem(ASSESSMENT_STORE, assessment);
}

export async function getOfflineAssessment(assessmentId: number): Promise<OfflineAssessment | undefined> {
  return getItem<OfflineAssessment>(ASSESSMENT_STORE, assessmentId);
}

export async function getAllOfflineAssessments(): Promise<OfflineAssessment[]> {
  return getAll<OfflineAssessment>(ASSESSMENT_STORE);
}

export async function removeOfflineAssessment(assessmentId: number): Promise<void> {
  await deleteItem(ASSESSMENT_STORE, assessmentId);
}

// ── Public API: Offline Queue ────────────────────────────────────────────────

export async function enqueueOfflineAction(
  type: OfflineQueueItem["type"],
  payload: Record<string, unknown>,
): Promise<void> {
  await putItem(QUEUE_STORE, {
    type,
    payload,
    createdAt: new Date().toISOString(),
    synced: 0,
    retryCount: 0,
  } as OfflineQueueItem);
}

export async function getPendingQueue(): Promise<OfflineQueueItem[]> {
  return getAllByIndex<OfflineQueueItem>(QUEUE_STORE, "synced", 0);
}

export async function markQueueItemSynced(queueId: number): Promise<void> {
  const item = await getItem<OfflineQueueItem>(QUEUE_STORE, queueId);
  if (item) {
    item.synced = 1;
    item.syncedAt = new Date().toISOString();
    await putItem(QUEUE_STORE, item);
  }
}

export async function incrementRetry(queueId: number): Promise<void> {
  const item = await getItem<OfflineQueueItem>(QUEUE_STORE, queueId);
  if (item) {
    item.retryCount += 1;
    await putItem(QUEUE_STORE, item);
  }
}

export async function clearSyncedQueue(): Promise<void> {
  const all = await getAll<OfflineQueueItem>(QUEUE_STORE);
  const synced = all.filter((item) => item.synced === 1);
  for (const item of synced) {
    if (item.queueId != null) {
      await deleteItem(QUEUE_STORE, item.queueId);
    }
  }
}

// ── Storage usage ────────────────────────────────────────────────────────────

export type StorageUsage = {
  lessonCount: number;
  deckCount: number;
  pdfCount: number;
  videoCount: number;
  assessmentCount: number;
  pendingQueueCount: number;
  estimatedSizeMB: number;
};

export async function getOfflineStorageUsage(): Promise<StorageUsage> {
  const lessonIds = await getAllKeys(LESSON_STORE);
  const deckIds = await getAllKeys(FLASHCARD_STORE);
  const pdfIds = await getAllKeys(PDF_STORE);
  const videoIds = await getAllKeys(VIDEO_STORE);
  const assessmentIds = await getAllKeys(ASSESSMENT_STORE);
  const pendingQueue = await getPendingQueue();

  // Get actual sizes for binary stores
  let binarySize = 0;
  const pdfs = await getAll<OfflinePdf>(PDF_STORE);
  for (const pdf of pdfs) binarySize += pdf.size || 0;
  const videos = await getAll<OfflineVideo>(VIDEO_STORE);
  for (const vid of videos) binarySize += vid.size || 0;

  // Text estimates: 3KB per lesson, 2KB per deck, 1KB per assessment
  const textSize = lessonIds.length * 3000 + deckIds.length * 2000 + assessmentIds.length * 1000;
  const totalBytes = binarySize + textSize;

  return {
    lessonCount: lessonIds.length,
    deckCount: deckIds.length,
    pdfCount: pdfIds.length,
    videoCount: videoIds.length,
    assessmentCount: assessmentIds.length,
    pendingQueueCount: pendingQueue.length,
    estimatedSizeMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
  };
}

export async function getStorageEstimate(): Promise<{
  usedMB: number;
  quotaMB: number;
  percentUsed: number;
}> {
  if (navigator.storage && navigator.storage.estimate) {
    const est = await navigator.storage.estimate();
    const usedMB = Math.round(((est.usage ?? 0) / (1024 * 1024)) * 100) / 100;
    const quotaMB = Math.round(((est.quota ?? 0) / (1024 * 1024)) * 100) / 100;
    return {
      usedMB,
      quotaMB,
      percentUsed: quotaMB > 0 ? Math.round((usedMB / quotaMB) * 100) : 0,
    };
  }
  return { usedMB: 0, quotaMB: 0, percentUsed: 0 };
}

export async function clearAllOfflineData(): Promise<void> {
  await clearStore(LESSON_STORE);
  await clearStore(FLASHCARD_STORE);
  await clearStore(PDF_STORE);
  await clearStore(VIDEO_STORE);
  await clearStore(ASSESSMENT_STORE);
  await clearStore(QUEUE_STORE);
  await clearStore(META_STORE);
}

// ── Network status helper ────────────────────────────────────────────────────

export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get effective connection type (2g, 3g, 4g, etc.)
 * Returns undefined if Network Information API is not supported
 */
export function getConnectionType(): string | undefined {
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; downlink?: number; saveData?: boolean };
  };
  return nav.connection?.effectiveType;
}

/**
 * Check if the connection is slow (2G or slow-3G)
 */
export function isSlowConnection(): boolean {
  const type = getConnectionType();
  if (!type) return false;
  return type === "slow-2g" || type === "2g";
}

/**
 * Check if user has data saver enabled
 */
export function isDataSaverOn(): boolean {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
  };
  return nav.connection?.saveData === true;
}

/**
 * Listen for online/offline events.
 * Returns a cleanup function.
 */
export function onNetworkChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true);
  const handleOffline = () => callback(false);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}
