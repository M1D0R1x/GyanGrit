// utils/slugs.ts
/**
 * URL slug helpers for GyanGrit human-readable routes.
 *
 * Course URLs:    /courses/:grade/:subject         e.g. /courses/10/punjabi
 * Assessment URLs: /assessments/:grade/:subject/:id  e.g. /assessments/10/punjabi/5
 *
 * Rules:
 *  - lowercase
 *  - spaces and underscores → hyphens
 *  - strip all non-alphanumeric except hyphens
 *  - collapse multiple hyphens
 *  - trim leading/trailing hyphens
 */

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function fromSlug(slug: string): string {
  // Capitalise each word — used for display labels only, not API calls
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Build the course detail path from grade + subject name */
export function courseDetailPath(grade: number, subjectName: string): string {
  return `/courses/${grade}/${toSlug(subjectName)}`;
}

/** Build the assessment detail path from grade + subject name + assessment id */
export function assessmentPath(grade: number, subjectName: string, assessmentId: number): string {
  return `/assessments/${grade}/${toSlug(subjectName)}/${assessmentId}`;
}

/** Build the assessment take path */
export function assessmentTakePath(grade: number, subjectName: string, assessmentId: number): string {
  return `/assessments/${grade}/${toSlug(subjectName)}/${assessmentId}/take`;
}

/** Build the assessment history path (per-assessment) */
export function assessmentHistoryPath(grade: number, subjectName: string, assessmentId: number): string {
  return `/assessments/${grade}/${toSlug(subjectName)}/${assessmentId}/history`;
}
