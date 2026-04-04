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
import { useCallback, useEffect, useRef, useState, useMemo } from "react";

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
  clearAction?: boolean;
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
  resetScene: () => void;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  readOnly: boolean;
  remoteState?: WhiteboardState | null;
  onBroadcast?: (state: WhiteboardState) => void;
}

const BROADCAST_THROTTLE_MS = 200;

// ── Component ────────────────────────────────────────────────────────────────

const UI_OPTIONS = {
  canvasActions: {
    loadScene: false,
    saveToActiveFile: false,
    export: false,
    clearCanvas: true,
  },
};

const INITIAL_APP_STATE = {
  viewBackgroundColor: "#ffffff",
  currentItemStrokeColor: "#1e1e24",
};

export default function Whiteboard({ readOnly, remoteState, onBroadcast }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ExcalidrawComp, setExcalidrawComp] = useState<React.ComponentType<any> | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Initialize refs
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const hasAppliedRemoteRef = useRef(false);

  // Memoize stable props before any early returns to obey React Hook Rules
  // We completely omit dynamic elements here and strictly use updateScene in useEffect!
  const initData = useMemo(() => ({
    appState: INITIAL_APP_STATE,
  }), []);

  const remoteStateRef = useRef(remoteState);
  useEffect(() => {
    remoteStateRef.current = remoteState;
  }, [remoteState]);

  const handleAPI = useCallback((api: ExcalidrawAPI) => { apiRef.current = api; }, []);

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

  // Apply remote state
  useEffect(() => {
    if (!remoteState || !apiRef.current) return;
    if (readOnly) {
      if (remoteState.elements.length === 0) apiRef.current.resetScene();
      else apiRef.current.updateScene({ elements: remoteState.elements });
    } else {
      // Teacher
      if (!hasAppliedRemoteRef.current) {
        if (remoteState.clearAction) apiRef.current.resetScene();
        else if (remoteState.elements.length > 0) apiRef.current.updateScene({ elements: remoteState.elements });
        hasAppliedRemoteRef.current = true;
      } else if (remoteState.clearAction) {
        // Handle explicit clear command sent to remoteState manually
        apiRef.current.resetScene();
      }
    }
  }, [remoteState, readOnly]);

  // Throttled broadcast (teacher)
  const handleChange = useCallback(
    (elements: readonly WhiteboardElement[], appState: MinimalAppState) => {
      if (readOnly || !onBroadcast) return;
      
      // Do not accept any changes (even empty ones) until we have finished injecting the saved state
      if (!hasAppliedRemoteRef.current && remoteStateRef.current !== null) return;

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

  // These hooks were illegally placed after conditional returns.
  // Wait, I will hoist them right now.
  const Exc = ExcalidrawComp;

  return (
    <div className="whiteboard-container">
      <Exc
        excalidrawAPI={handleAPI}
        onChange={handleChange}
        viewModeEnabled={readOnly}
        zenModeEnabled={false}
        gridModeEnabled={false}
        theme="light"
        autoFocus={false}
        UIOptions={UI_OPTIONS}
        initialData={initData}
      >
        {/* Empty fragment suppresses the default WelcomeScreen (lock icon + shapes panel) */}
      </Exc>
    </div>
  );
}

