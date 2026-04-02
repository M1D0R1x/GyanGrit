// components.NotificationDetailModal
/**
 * NotificationDetailModal
 *
 * Shows the full content of a notification:
 *   - Subject
 *   - Sender + time
 *   - Full message body rendered as safe Markdown
 *   - Attachment card (View + Download — two distinct actions)
 *   - "Open link" button — only for valid https:// or internal / links
 *
 * Attachment behaviour:
 *   View     → opens file for READING, no download:
 *              PDF/docs → Google Docs viewer (bypasses Content-Disposition: attachment)
 *              Images   → direct R2 URL (browsers render inline regardless of header)
 *   Download → raw R2 URL with <a download> — always triggers browser download
 *
 * Security:
 *   - Markdown parsed with `marked`, sanitized with DOMPurify before
 *     dangerouslySetInnerHTML. String() cast resolves TrustedHTML type (TS2345).
 *   - Allowed tags are a minimal prose subset — no script, img, iframe, style.
 *   - All <a href> values validated post-sanitize: only https:// and /
 *     survive. Everything else replaced with plain text.
 *   - External links get target="_blank" rel="noopener noreferrer".
 *   - attachment_url used only in explicit <a> tags — never iframe or embed.
 */
import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { marked } from "marked";
// Default import avoids TS2503 (cannot find namespace 'DOMPurify')
import DOMPurify from "dompurify";
import type { AppNotification } from "../services/notifications";

// ── Markdown setup ────────────────────────────────────────────────────────────

marked.setOptions({
  gfm:    true,   // **bold**, _italic_, - lists, [links](url)
  breaks: true,   // single \n → <br>
});

/**
 * Allowed HTML tags after Markdown parsing.
 *
 * Tag          | Markdown source          | Renders as
 * -------------|--------------------------|--------------------------------
 * p            | any paragraph            | block of text
 * br           | line break (\n)          | single line break
 * strong / b   | **bold** or __bold__     | bold text
 * em / i       | _italic_ or *italic*     | italic text
 * ul           | - item                   | bullet list container
 * ol           | 1. item                  | numbered list container
 * li           | list item                | individual list item
 * a            | [text](url)              | hyperlink (href validated below)
 * blockquote   | > quoted text            | indented quote block
 * code         | `inline code`            | monospace inline
 * pre          | ```fenced block```       | monospace preformatted block
 *
 * Everything else (script, img, iframe, style, div, span, etc.) is stripped.
 */
const ALLOWED_TAGS = [
  "p", "br",
  "strong", "b",
  "em", "i",
  "ul", "ol", "li",
  "a",
  "blockquote",
  "code", "pre",
];

function renderMarkdown(raw: string): string {
  if (!raw.trim()) return "";

  // Step 1 — parse Markdown to HTML
  const html = marked.parse(raw) as string;

  // Step 2 — sanitize with DOMPurify
  //   String() cast converts TrustedHTML → string, fixing TS2345
  const clean = String(
    DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR: ["href"],  // only href on <a> — no class, style, id, etc.
    })
  );

  // Step 3 — post-sanitize: validate every <a href>
  //   DOMPurify already removed dangerous protocols, but we additionally:
  //   - Allow only https:// (external) and / (internal SPA routes)
  //   - Add target="_blank" rel="noopener noreferrer" to all external links
  //   - Replace everything else with its plain text content
  const doc = new DOMParser().parseFromString(clean, "text/html");
  doc.querySelectorAll("a").forEach((el) => {
    const href = el.getAttribute("href") ?? "";
    if (href.startsWith("https://")) {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    } else if (href.startsWith("/")) {
      el.removeAttribute("target");
      el.removeAttribute("rel");
    } else {
      // Strip the link, keep the visible text
      el.replaceWith(el.textContent ?? "");
    }
  });

  return doc.body.innerHTML;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day:    "numeric",
    month:  "long",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

function isExternalLink(link: string): boolean {
  return link.startsWith("https://");
}

function isValidLink(link: string): boolean {
  return link.startsWith("https://") || link.startsWith("/");
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf")                                  return "📄";
  if (["doc", "docx"].includes(ext))                  return "📝";
  if (["xls", "xlsx"].includes(ext))                  return "📊";
  if (["jpg", "jpeg", "png", "webp"].includes(ext))   return "🖼️";
  return "📎";
}

/** True for file types that browsers render inline (no proxy needed). */
function isImage(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
}

/**
 * Returns the URL to use for the "View" button — opens without downloading.
 *
 * Why this is needed:
 *   R2 sets Content-Disposition: attachment on every upload (see r2.py).
 *   The raw R2 URL always triggers a download even with target="_blank".
 *   There is no way to override this client-side.
 *
 * Fix:
 *   - Images  → direct R2 URL. Browsers render images inline regardless of
 *               Content-Disposition, so no proxy needed.
 *   - PDF/docs → Google Docs viewer. It fetches the file server-side and
 *               renders it as HTML, bypassing the Content-Disposition header
 *               entirely. The user sees the document in their browser.
 */
function getViewUrl(url: string, name: string): string {
  if (isImage(name)) return url;
  return `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=true`;
}

const TYPE_COLORS: Record<string, string> = {
  info:         "#3b82f6",
  success:      "#10b981",
  warning:      "#f59e0b",
  error:        "#ef4444",
  announcement: "#8b5cf6",
  assessment:   "#10b981",
  lesson:       "#3b82f6",
};

const TYPE_ICONS: Record<string, string> = {
  info:         "ℹ",
  success:      "✓",
  warning:      "⚠",
  error:        "✕",
  announcement: "📢",
  assessment:   "📝",
  lesson:       "📖",
};

// ── Component ─────────────────────────────────────────────────────────────────

type Props = {
  notification: AppNotification;
  onClose:      () => void;
};

export default function NotificationDetailModal({ notification: n, onClose }: Props) {
  const navigate   = useNavigate();
  const overlayRef = useRef<HTMLDivElement>(null);

  // Only re-parse + sanitize when n.message changes
  const renderedBody = useMemo(() => renderMarkdown(n.message), [n.message]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Move focus to first focusable element for accessibility
  useEffect(() => {
    const first = overlayRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    first?.focus();
  }, []);

  const typeColor = TYPE_COLORS[n.type] ?? "#3b82f6";
  const typeIcon  = TYPE_ICONS[n.type]  ?? "ℹ";
  const hasLink   = !!n.link && isValidLink(n.link);
  const hasFile   = !!n.attachment_url && !!n.attachment_name;

  const handleLinkClick = () => {
    if (!hasLink) return;
    if (isExternalLink(n.link)) {
      window.open(n.link, "_blank", "noopener,noreferrer");
    } else {
      onClose();
      navigate(n.link);
    }
  };

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position:       "fixed",
        inset:          0,
        background:     "rgba(0, 0, 0, 0.15)",
        zIndex:         10000,
        display:        "flex",
        alignItems:     "flex-start",
        justifyContent: "center",
        padding:        "5vh 1rem",
        overflowY:      "auto",
      }}
    >
      <div style={{
        background:    "var(--glass-fill)",
        border:        "1px solid var(--glass-stroke)",
        borderRadius:  "var(--radius-lg)",
        width:         "min(580px, 100%)",
        maxHeight:     "calc(90vh - 2rem)",
        display:       "flex",
        flexDirection: "column",
        overflow:      "hidden",
        animation:     "fadeInUp 0.18s ease both",
        boxShadow:     "var(--shadow-xl)",
        backdropFilter:       "blur(16px)",
        WebkitBackdropFilter: "blur(16px)",
      }}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div style={{
          display:       "flex",
          alignItems:    "flex-start",
          gap:           "var(--space-4)",
          padding:       "var(--space-5) var(--space-6)",
          borderBottom:  "1px solid var(--border-light)",
          background:    "var(--bg-surface)",
          flexShrink:    0,
        }}>
          {/* Type icon */}
          <div style={{
            width:          40,
            height:         40,
            borderRadius:   "50%",
            background:     typeColor + "22",
            color:          typeColor,
            display:        "flex",
            alignItems:     "center",
            justifyContent: "center",
            fontSize:       18,
            fontWeight:     700,
            flexShrink:     0,
          }}>
            {typeIcon}
          </div>

          {/* Subject + meta */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="notif-modal-title"
              style={{
                fontFamily:    "var(--font-display)",
                fontWeight:    800,
                fontSize:      "var(--text-lg)",
                color:         "var(--ink-primary)",
                margin:        0,
                lineHeight:    1.3,
                letterSpacing: "-0.02em",
              }}
            >
              {n.subject}
            </h2>
            <div style={{
              display:   "flex",
              flexWrap:  "wrap",
              gap:       "var(--space-2)",
              marginTop: "var(--space-2)",
              fontSize:  "var(--text-xs)",
              color:     "var(--ink-secondary)",
              fontWeight: 500,
            }}>
              {n.sender && n.sender !== "System" && (
                <span style={{ fontWeight: 700, color: "var(--ink-primary)" }}>
                  {n.sender}
                </span>
              )}
              {n.sender && n.sender !== "System" && <span>·</span>}
              <span>{formatDate(n.created_at)}</span>
            </div>
          </div>

          {/* Close */}
          <button
            onClick={onClose}
            aria-label="Close notification"
            style={{
              background:   "none",
              border:       "none",
              cursor:       "pointer",
              color:        "var(--ink-muted)",
              fontSize:     20,
              lineHeight:   1,
              padding:      "var(--space-1)",
              flexShrink:   0,
              borderRadius: "var(--radius-sm)",
              transition:   "color 0.1s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--ink-primary)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--ink-muted)")}
          >
            ✕
          </button>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{
          flex:          1,
          overflowY:     "auto",
          padding:       "var(--space-6)",
          display:       "flex",
          flexDirection: "column",
          gap:           "var(--space-5)",
        }}>

          {/* Markdown body — safe HTML via DOMPurify + href validation */}
          {n.message ? (
            <div
              className="notification-body"
              style={{ color: "var(--ink-primary)", fontSize: "var(--text-base)", fontWeight: 500 }}
              dangerouslySetInnerHTML={{ __html: renderedBody }}
            />
          ) : (
            <p style={{ color: "var(--ink-secondary)", fontStyle: "italic", fontSize: "var(--text-sm)" }}>
              No message body.
            </p>
          )}

          {/* Attachment card */}
          {hasFile && (
            <div style={{
              display:      "flex",
              alignItems:   "center",
              gap:          "var(--space-4)",
              padding:      "var(--space-4)",
              background:   "var(--bg-surface)",
              border:       "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
            }}>
              <div style={{ fontSize: 28, flexShrink: 0 }}>
                {getFileIcon(n.attachment_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight:   600,
                  fontSize:     "var(--text-sm)",
                  color:        "var(--ink-primary)",
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                }}>
                  {n.attachment_name}
                </div>
                <div style={{ fontSize: "var(--text-xs)", color: "var(--ink-muted)", marginTop: 2 }}>
                  {isImage(n.attachment_name) ? "Image" : "Document"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--space-2)", flexShrink: 0 }}>

                {/*
                  VIEW — uses getViewUrl():
                    Images  → direct R2 URL (browser renders inline)
                    PDF/doc → Google Docs viewer (bypasses Content-Disposition: attachment)
                  Never triggers a download.
                */}
                <a
                  href={getViewUrl(n.attachment_url, n.attachment_name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    padding:        "var(--space-2) var(--space-3)",
                    background:     "var(--bg-elevated)",
                    border:         "1px solid var(--border-medium)",
                    borderRadius:   "var(--radius-sm)",
                    fontSize:       "var(--text-xs)",
                    color:          "var(--ink-secondary)",
                    cursor:         "pointer",
                    textDecoration: "none",
                    fontWeight:     600,
                  }}
                >
                  View
                </a>

                {/*
                  DOWNLOAD — raw R2 URL + download attribute.
                  R2 Content-Disposition: attachment ensures browser downloads.
                */}
                <a
                  href={n.attachment_url}
                  download={n.attachment_name}
                  style={{
                    padding:        "var(--space-2) var(--space-3)",
                    background:     "var(--saffron)",
                    border:         "none",
                    borderRadius:   "var(--radius-sm)",
                    fontSize:       "var(--text-xs)",
                    color:          "#fff",
                    cursor:         "pointer",
                    textDecoration: "none",
                    fontWeight:     600,
                  }}
                >
                  ↓ Download
                </a>
              </div>
            </div>
          )}

          {/* Link card — explicit user action only, never auto-followed */}
          {hasLink && (
            <div style={{
              padding:      "var(--space-4)",
              background:   "var(--bg-surface)",
              border:       "1px solid var(--border-light)",
              borderRadius: "var(--radius-md)",
              display:      "flex",
              alignItems:   "center",
              gap:          "var(--space-3)",
            }}>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize:      "var(--text-xs)",
                  color:         "var(--ink-secondary)",
                  fontWeight:    700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  marginBottom:  2,
                }}>
                  Linked resource
                </div>
                <div style={{
                  fontSize:     "var(--text-sm)",
                  color:        "var(--ink-primary)",
                  fontWeight:   600,
                  overflow:     "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace:   "nowrap",
                }}>
                  {n.link}
                </div>
              </div>
              <button
                onClick={handleLinkClick}
                style={{
                  padding:      "var(--space-2) var(--space-4)",
                  background:   "none",
                  border:       "1px solid var(--border-medium)",
                  borderRadius: "var(--radius-sm)",
                  fontSize:     "var(--text-xs)",
                  color:        "var(--saffron)",
                  cursor:       "pointer",
                  fontWeight:   600,
                  whiteSpace:   "nowrap",
                  transition:   "all 0.1s",
                }}
              >
                {isExternalLink(n.link) ? "Open ↗" : "Go →"}
              </button>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{
          padding:        "var(--space-4) var(--space-6)",
          borderTop:      "1px solid var(--border-light)",
          background:     "var(--bg-surface)",
          flexShrink:     0,
          display:        "flex",
          justifyContent: "flex-end",
        }}>
          <button onClick={onClose} className="btn btn--secondary">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}