type Props = {
  title: string;
  order: number;
  completed: boolean;
  onSelect: () => void;
  onComplete?: () => void;
};

/**
 * Renders a single lesson row.
 *
 * Rules:
 * - Completion state comes ONLY from backend
 * - Completed lessons are visually downgraded
 * - Completion action is explicit and separate
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
        opacity: completed ? 0.6 : 1,
      }}
    >
      {/* Lesson navigation */}
      <button onClick={onSelect}>
        {order}. {title}
      </button>

      {/* Completion indicator */}
      {completed && <span aria-label="completed">✅</span>}

      {/* Explicit completion action (alpha only) */}
      {!completed && onComplete && (
        <button
          onClick={onComplete}
          style={{ marginLeft: "auto" }}
          aria-label="mark-complete"
        >
          Mark complete
        </button>
      )}
    </li>
  );
}
