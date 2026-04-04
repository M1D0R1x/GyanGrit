// components/Whiteboard.tsx
/**
 * Excalidraw whiteboard wrapper for live sessions.
 *
 * Two modes:
 *   Teacher (readOnly=false): draws, changes broadcast via onBroadcast.
 *   Student (readOnly=true): receives state via remoteState, renders read-only.
 *
 * Persistence: teacher's whiteboard state saved to localStorage keyed by
 * sessionId so it survives page refreshes.
 *
 * Fixes applied 2026-04-04:
 *   - hasAppliedRemoteRef set to true on localStorage restore so teacher's
 *     first draw after refresh is broadcast immediately (was silently suppressed)
 *   - clearAction handled correctly for both teacher and student
 */
import { useCallback, useEffect, useRef, useState, useMemo } from "react";

export interface WhiteboardElement {
  id: string;
  type: string;
  x: number;
  y: number;
  [key: string]: unknown;
}

export interface WhiteboardState {
  type: "whiteboard";
  elements: WhiteboardElement[];
  scrollX: number;
  scrollY: number;
  zoom: number;
  clearAction?: boolean;
}

interface MinimalAppState {
  scrollX: number;
  scrollY: number;
  zoom: { value: number };
  [key: string]: unknown;
}

interface ExcalidrawAPI {
  updateScene: (scene: { elements: WhiteboardElement[] }) => void;
  getSceneElements: () => WhiteboardElement[];
  resetScene: () => void;
}

interface Props {
  readOnly: boolean;
  remoteState?: WhiteboardState | null;
  onBroadcast?: (state: WhiteboardState) => void;
}

const BROADCAST_THROTTLE_MS = 200;

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
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const pendingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastBroadcastRef = useRef<number>(0);

  // KEY FIX: if we have a saved remoteState (from localStorage restore), mark as already
  // applied so teacher's first draw immediately broadcasts instead of being suppressed.
  const hasAppliedRemoteRef = useRef<boolean>(
    !readOnly && remoteState !== null && remoteState !== undefined
  );

  const initData = useMemo(() => ({
    appState: INITIAL_APP_STATE,
  }), []);

  const remoteStateRef = useRef(remoteState);
  useEffect(() => {
    remoteStateRef.current = remoteState;
  }, [remoteState]);

  const handleAPI = useCallback((api: ExcalidrawAPI) => {
    apiRef.current = api;
    // Immediately apply any saved state when API becomes available
    if (api && remoteStateRef.current) {
      if (remoteStateRef.current.elements.length > 0) {
        api.updateScene({ elements: remoteStateRef.current.elements });
      }
      hasAppliedRemoteRef.current = true;
    }
  }, []);

  // Dynamic import
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
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

  // Apply remote state updates from data channel
  useEffect(() => {
    if (!remoteState || !apiRef.current) return;

    if (remoteState.clearAction) {
      apiRef.current.resetScene();
      hasAppliedRemoteRef.current = true;
      return;
    }

    if (readOnly) {
      // Student: always apply whatever teacher sends
      if (remoteState.elements.length === 0) {
        apiRef.current.resetScene();
      } else {
        apiRef.current.updateScene({ elements: remoteState.elements });
      }
    } else {
      // Teacher: only apply on first load (don't overwrite mid-session drawing)
      if (!hasAppliedRemoteRef.current) {
        if (remoteState.elements.length > 0) {
          apiRef.current.updateScene({ elements: remoteState.elements });
        }
        hasAppliedRemoteRef.current = true;
      }
    }
  }, [remoteState, readOnly]);

  // Throttled broadcast (teacher only)
  const handleChange = useCallback(
    (elements: readonly WhiteboardElement[], appState: MinimalAppState) => {
      if (readOnly || !onBroadcast) return;
      // Block broadcasts until initial state is applied
      if (!hasAppliedRemoteRef.current) return;

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
        excalidrawAPI={handleAPI}
        onChange={handleChange}
        viewModeEnabled={readOnly}
        zenModeEnabled={false}
        gridModeEnabled={false}
        theme="light"
        autoFocus={false}
        UIOptions={UI_OPTIONS}
        initialData={initData}
      />
    </div>
  );
}
