// components/Whiteboard.tsx
/**
 * Excalidraw whiteboard wrapper for live sessions.
 *
 * Two modes:
 *   - Teacher (readOnly=false): can draw, erase, annotate. Changes are
 *     broadcast to students via the onBroadcast callback.
 *   - Student (readOnly=true): receives whiteboard state updates and
 *     renders them read-only.
 *
 * The parent (LiveSessionPage) is responsible for:
 *   1. Calling onBroadcast with serialized state → sends via LiveKit data channel
 *   2. Passing incoming whiteboard state updates as the `remoteState` prop
 *
 * Throttling: teacher changes are broadcast at most every 200ms to avoid
 * flooding the data channel. Excalidraw fires onChange on every stroke point,
 * so without throttling we'd send 60+ messages per second while drawing.
 *
 * Package: @excalidraw/excalidraw (must be installed separately)
 *   npm install @excalidraw/excalidraw
 */
import { useCallback, useEffect, useRef, useState } from "react";

// Dynamic import types — actual import happens at render time via lazy loading
import type {
  ExcalidrawElement,
} from "@excalidraw/excalidraw/types/element/types";
import type { AppState } from "@excalidraw/excalidraw/types/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";

// Lazy-load the heavy Excalidraw component
let ExcalidrawComponent: React.ComponentType<Record<string, unknown>> | null = null;
let excalidrawLoaded = false;

async function loadExcalidraw() {
  if (excalidrawLoaded) return;
  const mod = await import("@excalidraw/excalidraw");
  ExcalidrawComponent = mod.Excalidraw;
  excalidrawLoaded = true;
}

// Serialized whiteboard state sent over data channel
export type WhiteboardState = {
  type: "whiteboard";
  elements: ExcalidrawElement[];
  // Only send scroll position, not full appState (too large)
  scrollX: number;
  scrollY: number;
  zoom: number;
};

type Props = {
  readOnly: boolean;
  remoteState?: WhiteboardState | null;
  onBroadcast?: (state: WhiteboardState) => void;
};

const BROADCAST_THROTTLE_MS = 200;

export default function Whiteboard({ readOnly, remoteState, onBroadcast }: Props) {
  const [loaded, setLoaded] = useState(excalidrawLoaded);
  const [error, setError] = useState<string | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const lastBroadcastRef = useRef(0);
  const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load Excalidraw on mount
  useEffect(() => {
    if (excalidrawLoaded) {
      setLoaded(true);
      return;
    }
    loadExcalidraw()
      .then(() => setLoaded(true))
      .catch((err) => {
        console.error("[Whiteboard] Failed to load Excalidraw:", err);
        setError("Failed to load whiteboard. Please refresh the page.");
      });
  }, []);

  // Apply remote state updates (student view)
  useEffect(() => {
    if (!remoteState || !apiRef.current || !readOnly) return;

    apiRef.current.updateScene({
      elements: remoteState.elements,
    });
    apiRef.current.scrollToContent(undefined, {
      fitToViewport: false,
    });
  }, [remoteState, readOnly]);

  // Throttled broadcast of whiteboard changes (teacher)
  const handleChange = useCallback(
    (elements: readonly ExcalidrawElement[], appState: AppState) => {
      if (readOnly || !onBroadcast) return;

      const now = Date.now();
      const broadcast = () => {
        lastBroadcastRef.current = Date.now();
        onBroadcast({
          type: "whiteboard",
          elements: elements as ExcalidrawElement[],
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom.value,
        });
      };

      if (now - lastBroadcastRef.current >= BROADCAST_THROTTLE_MS) {
        broadcast();
      } else {
        // Schedule a trailing broadcast
        if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
        pendingBroadcastRef.current = setTimeout(broadcast, BROADCAST_THROTTLE_MS);
      }
    },
    [readOnly, onBroadcast]
  );

  // Cleanup pending broadcast on unmount
  useEffect(() => {
    return () => {
      if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
    };
  }, []);

  if (error) {
    return (
      <div className="whiteboard-error">
        <span>⚠️ {error}</span>
      </div>
    );
  }

  if (!loaded || !ExcalidrawComponent) {
    return (
      <div className="whiteboard-loading">
        <div className="auth-loading__spinner" />
        <span>Loading whiteboard…</span>
      </div>
    );
  }

  const Excalidraw = ExcalidrawComponent;

  return (
    <div className="whiteboard-container">
      <Excalidraw
        excalidrawAPI={(api: ExcalidrawImperativeAPI) => { apiRef.current = api; }}
        onChange={handleChange}
        viewModeEnabled={readOnly}
        zenModeEnabled={false}
        gridModeEnabled={false}
        theme="dark"
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
            currentItemFontFamily: 1,
          },
        }}
      />
    </div>
  );
}
