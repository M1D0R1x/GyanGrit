// components/Whiteboard.tsx
/**
 * Excalidraw whiteboard wrapper for live sessions.
 *
 * All @excalidraw types are defined locally to avoid TS2307 errors when
 * the package is not yet installed (Vercel installs on build, but tsc
 * runs before vite bundles). The actual Excalidraw component is loaded
 * via dynamic import() at runtime only.
 *
 * Two modes:
 *   - Teacher (readOnly=false): can draw. Changes broadcast via onBroadcast.
 *   - Student (readOnly=true): receives state updates, renders read-only.
 */
import { useCallback, useEffect, useRef, useState } from "react";

// ── Local type definitions (avoids importing from @excalidraw at compile time) ─

/** Minimal ExcalidrawElement shape — only the fields we serialize over data channel */
export interface WhiteboardElement {
  id: string;
  type: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

/** Serialized whiteboard state sent over LiveKit data channel */
export interface WhiteboardState {
  type: "whiteboard";
  elements: WhiteboardElement[];
  scrollX: number;
  scrollY: number;
  zoom: number;
}

/** Minimal AppState shape for the onChange callback */
interface MinimalAppState {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
  [key: string]: unknown;
}

/** Excalidraw imperative API — only the methods we use */
interface ExcalidrawAPI {
  updateScene: (scene: { elements: WhiteboardElement[] }) => void;
  getSceneElements: () => WhiteboardElement[];
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  readOnly: boolean;
  remoteState?: WhiteboardState | null;
  onBroadcast?: (state: WhiteboardState) => void;
}

const BROADCAST_THROTTLE_MS = 200;

// ── Component ────────────────────────────────────────────────────────────────

export default function Whiteboard({ readOnly, remoteState, onBroadcast }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ExcalidrawComp, setExcalidrawComp] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const lastBroadcastRef = useRef(0);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dynamic import — loads Excalidraw + its CSS at runtime only
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Import CSS first so the toolbar and canvas render correctly
        await import("@excalidraw/excalidraw/index.css");
        const mod = await import("@excalidraw/excalidraw");
        if (!cancelled) setExcalidrawComp(() => mod.Excalidraw);
      } catch (err: unknown) {
        console.error("[Whiteboard] Failed to load Excalidraw:", err);
        if (!cancelled) setError("Failed to load whiteboard. Please refresh.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Apply remote state (student view)
  useEffect(() => {
    if (!remoteState || !apiRef.current || !readOnly) return;
    apiRef.current.updateScene({ elements: remoteState.elements });
  }, [remoteState, readOnly]);

  // Throttled broadcast (teacher)
  const handleChange = useCallback(
    (elements: readonly WhiteboardElement[], appState: MinimalAppState) => {
      if (readOnly || !onBroadcast) return;
      const now = Date.now();
      const broadcast = () => {
        lastBroadcastRef.current = Date.now();
        onBroadcast({
          type: "whiteboard",
          elements: [...elements],
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom.value,
        });
      };
      if (now - lastBroadcastRef.current >= BROADCAST_THROTTLE_MS) {
        broadcast();
      } else {
        if (pendingRef.current) clearTimeout(pendingRef.current);
        pendingRef.current = setTimeout(broadcast, BROADCAST_THROTTLE_MS);
      }
    },
    [readOnly, onBroadcast],
  );

  useEffect(() => {
    return () => { if (pendingRef.current) clearTimeout(pendingRef.current); };
  }, []);

  if (error) {
    return <div className="whiteboard-error"><span>{error}</span></div>;
  }

  if (!ExcalidrawComp) {
    return (
      <div className="whiteboard-loading">
        <div className="auth-loading__spinner" />
        <span>Loading whiteboard...</span>
      </div>
    );
  }

  const Exc = ExcalidrawComp;

  return (
    <div className="whiteboard-container">
      <Exc
        excalidrawAPI={(api: ExcalidrawAPI) => { apiRef.current = api; }}
        onChange={handleChange}
        viewModeEnabled={readOnly}
        zenModeEnabled={false}
        gridModeEnabled={false}
        theme="dark"
        autoFocus={true}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
          },
        }}
        initialData={{
          elements: remoteState?.elements ?? [],
          appState: {
            viewBackgroundColor: "#1a1a2e",
            currentItemStrokeColor: "#ffffff",
          },
        }}
      >
        {/* Empty fragment suppresses the default WelcomeScreen (lock icon + shapes panel) */}
      </Exc>
    </div>
  );
}

