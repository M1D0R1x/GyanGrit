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
 *   1. Calling onBroadcast with serialized state -> sends via LiveKit data channel
 *   2. Passing incoming whiteboard state updates as the `remoteState` prop
 *
 * Throttling: teacher changes are broadcast at most every 200ms to avoid
 * flooding the data channel. Excalidraw fires onChange on every stroke point,
 * so without throttling we'd send 60+ messages per second while drawing.
 *
 * Package: @excalidraw/excalidraw@0.18.0
 */
import { useCallback, useEffect, useRef, useState } from "react";

// v0.18.0 type imports — uses the package exports map ("./*" -> "./dist/types/excalidraw/*.d.ts")
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, ExcalidrawImperativeAPI, ExcalidrawProps } from "@excalidraw/excalidraw/types";

// Serialized whiteboard state sent over data channel
export type WhiteboardState = {
  type: "whiteboard";
  elements: ExcalidrawElement[];
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
  const [ExcalidrawComp, setExcalidrawComp] = useState<React.ComponentType<ExcalidrawProps> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const lastBroadcastRef = useRef(0);
  const pendingBroadcastRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dynamic import of the heavy Excalidraw component
  useEffect(() => {
    let cancelled = false;
    import("@excalidraw/excalidraw")
      .then((mod) => {
        if (!cancelled) {
          // mod.Excalidraw is a MemoExoticComponent — cast to satisfy TS
          setExcalidrawComp(() => mod.Excalidraw as unknown as React.ComponentType<ExcalidrawProps>);
        }
      })
      .catch((err: unknown) => {
        console.error("[Whiteboard] Failed to load Excalidraw:", err);
        if (!cancelled) setError("Failed to load whiteboard. Please refresh the page.");
      });
    return () => { cancelled = true; };
  }, []);

  // Apply remote state updates (student view)
  useEffect(() => {
    if (!remoteState || !apiRef.current || !readOnly) return;
    apiRef.current.updateScene({ elements: remoteState.elements });
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
          elements: [...elements],
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
          zoom: appState.zoom.value,
        });
      };

      if (now - lastBroadcastRef.current >= BROADCAST_THROTTLE_MS) {
        broadcast();
      } else {
        if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
        pendingBroadcastRef.current = setTimeout(broadcast, BROADCAST_THROTTLE_MS);
      }
    },
    [readOnly, onBroadcast],
  );

  // Cleanup pending broadcast on unmount
  useEffect(() => {
    return () => {
      if (pendingBroadcastRef.current) clearTimeout(pendingBroadcastRef.current);
    };
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

  return (
    <div className="whiteboard-container">
      <ExcalidrawComp
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
          },
        }}
      />
    </div>
  );
}
