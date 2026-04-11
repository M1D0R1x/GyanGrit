import { useEffect } from "react";

/**
 * Sets `document.title` and optional meta description for the current page.
 *
 * Automatically appends " — GyanGrit" suffix for consistency.
 * Restores the default title on unmount (cleanup).
 *
 * Usage:
 *   usePageTitle("Dashboard");
 *   usePageTitle("About", "Learn about GyanGrit's mission");
 */
export function usePageTitle(title: string, description?: string) {
  useEffect(() => {
    const formatted = title ? `${title} — GyanGrit` : "GyanGrit";
    document.title = formatted;

    // Set/update meta description if provided
    let metaDesc = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]'
    );
    const originalDesc = metaDesc?.content ?? "";

    if (description) {
      if (!metaDesc) {
        metaDesc = document.createElement("meta");
        metaDesc.name = "description";
        document.head.appendChild(metaDesc);
      }
      metaDesc.content = description;
    }

    return () => {
      document.title = "GyanGrit";
      if (metaDesc && originalDesc) {
        metaDesc.content = originalDesc;
      }
    };
  }, [title, description]);
}
