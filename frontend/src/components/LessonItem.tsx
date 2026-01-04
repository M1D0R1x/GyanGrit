type Props = {
  title: string;
  order: number;
  completed: boolean;
  onSelect: () => void;
  onComplete?: () => void;
};

/**
 * Lesson list item.
 *
 * UX rules:
 * - Navigation is primary
 * - Completion is explicit and secondary
 * - Completed lessons are clearly marked
 */
export default function LessonItem({
  title,
  order,
  completed,
  onSelect,
  onComplete,
}: Props) {
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "6px 0",
        opacity: completed ? 0.65 : 1,
      }}
    >
      {/* Primary navigation */}
      <button
        onClick={onSelect}
        style={{ fontWeight: completed ? "normal" : "bold" }}
      >
        {order}. {title}
      </button>

      {/* Completion indicator */}
      {completed && <span title="Completed">✅</span>}

      {/* Explicit completion (alpha only) */}
      {!completed && onComplete && (
        <button
          onClick={onComplete}
          style={{ marginLeft: "auto", fontSize: "0.85em" }}
        >
          Mark complete
        </button>
      )}
    </li>
  );
}
