// services/offline.ts
/**
 * Offline content storage using IndexedDB.
 *
 * Stores:
 *   - Text lesson content (title, content, PDF URL — no video blobs)
 *   - Flashcard decks (front, back, hint)
 *
 * Security:
 *   - Content is tied to the user session — clearing cookies clears offline state
 *   - Single-session enforcement still applies: offline mode is READ-ONLY
 *   - No progress PATCH is sent while offline — queued for sync when online
 *   - Videos are NOT stored (too large for mobile storage)
 *
 * Storage limit:
 *   - Most mobile browsers allow ~50MB per origin in IndexedDB
 *   - A text lesson is ~2-5KB, flashcard deck ~1-3KB
 *   - 1000 lessons + 100 decks ≈ 5-8MB — well within limit
 */

const DB_NAME = "gyangrit-offline";
const DB_VERSION = 1;
const LESSON_STORE = "lessons";
const FLASHCARD_STORE = "flashcards";

// ── IndexedDB setup ──────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LESSON_STORE)) {
        const store = db.createObjectStore(LESSON_STORE, { keyPath: "id" });
        store.createIndex("courseId", "courseId", { unique: false });
      }
      if (!db.objectStoreNames.contains(FLASHCARD_STORE)) {
        const store = db.createObjectStore(FLASHCARD_STORE, { keyPath: "deckId" });
        store.createIndex("subjectId", "subjectId", { unique: false });
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

async function getItem<T>(storeName: string, key: number): Promise<T | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).get(key);
    req.onsuccess = () => { db.close(); resolve(req.result as T | undefined); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function getAllByIndex<T>(storeName: string, indexName: string, value: number): Promise<T[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const index = tx.objectStore(storeName).index(indexName);
    const req = index.getAll(value);
    req.onsuccess = () => { db.close(); resolve(req.result as T[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

async function deleteItem(storeName: string, key: number): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function getAllKeys(storeName: string): Promise<number[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const req = tx.objectStore(storeName).getAllKeys();
    req.onsuccess = () => { db.close(); resolve(req.result as number[]); };
    req.onerror = () => { db.close(); reject(req.error); };
  });
}

// ── Lesson types ─────────────────────────────────────────────────────────────

export type OfflineLesson = {
  id: number;
  courseId: number;
  title: string;
  content: string;
  pdfUrl: string;
  order: number;
  savedAt: string; // ISO timestamp
};

// ── Flashcard types ──────────────────────────────────────────────────────────

export type OfflineFlashcardDeck = {
  deckId: number;
  subjectId: number;
  title: string;
  cards: { front: string; back: string; hint: string }[];
  savedAt: string;
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

export async function removeOfflineLesson(lessonId: number): Promise<void> {
  await deleteItem(LESSON_STORE, lessonId);
}

export async function getSavedLessonIds(): Promise<number[]> {
  return getAllKeys(LESSON_STORE);
}

export async function isLessonSavedOffline(lessonId: number): Promise<boolean> {
  const lesson = await getItem<OfflineLesson>(LESSON_STORE, lessonId);
  return lesson !== undefined;
}

// ── Public API: Flashcards ───────────────────────────────────────────────────

export async function saveFlashcardDeckOffline(deck: OfflineFlashcardDeck): Promise<void> {
  await putItem(FLASHCARD_STORE, deck);
}

export async function getOfflineFlashcardDeck(deckId: number): Promise<OfflineFlashcardDeck | undefined> {
  return getItem<OfflineFlashcardDeck>(FLASHCARD_STORE, deckId);
}

export async function removeOfflineFlashcardDeck(deckId: number): Promise<void> {
  await deleteItem(FLASHCARD_STORE, deckId);
}

export async function getSavedDeckIds(): Promise<number[]> {
  return getAllKeys(FLASHCARD_STORE);
}

// ── Storage usage ────────────────────────────────────────────────────────────

export async function getOfflineStorageUsage(): Promise<{
  lessonCount: number;
  deckCount: number;
  estimatedSizeMB: number;
}> {
  const lessonIds = await getAllKeys(LESSON_STORE);
  const deckIds = await getAllKeys(FLASHCARD_STORE);

  // Rough estimate: 3KB per lesson, 2KB per deck
  const estimatedBytes = lessonIds.length * 3000 + deckIds.length * 2000;

  return {
    lessonCount: lessonIds.length,
    deckCount: deckIds.length,
    estimatedSizeMB: Math.round((estimatedBytes / (1024 * 1024)) * 100) / 100,
  };
}

export async function clearAllOfflineData(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([LESSON_STORE, FLASHCARD_STORE], "readwrite");
    tx.objectStore(LESSON_STORE).clear();
    tx.objectStore(FLASHCARD_STORE).clear();
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

// ── Network status helper ────────────────────────────────────────────────────

export function isOnline(): boolean {
  return navigator.onLine;
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
