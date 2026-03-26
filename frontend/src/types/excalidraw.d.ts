// Type shim for @excalidraw/excalidraw
// The actual types come from the package when installed, but this shim
// ensures tsc doesn't fail if the package types aren't resolved yet.
// The dynamic import() in Whiteboard.tsx only needs the Excalidraw export.
declare module "@excalidraw/excalidraw" {
  import type { ComponentType } from "react";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Excalidraw: ComponentType<any>;
}
