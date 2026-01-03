type Props = {
  id: number;
  title: string;
  order: number;
  completed: boolean;
  onSelect: () => void;
  onComplete?: () => void;
};

/**
 * Renders a single lesson row with:
 * - order number
 * - completion indicator
 * - optional "mark complete" action
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
        gap: "8px",
        opacity: completed ? 0.6 : 1,
      }}
    >
      {/* Lesson title */}
      <button onClick={onSelect}>
        {order}. {title}
      </button>

      {/* Completion indicator */}
      {completed && <span>✅</span>}

      {/* Optional manual completion (alpha/testing only) */}
      {!completed && onComplete && (
        <button
          onClick={onComplete}
          style={{ marginLeft: "auto" }}
        >
          Mark complete
        </button>
      )}
    </li>
  );
}
