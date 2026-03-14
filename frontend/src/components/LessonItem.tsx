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
 * - Entire row is clickable for navigation
 * - Completion action is explicit and secondary
 * - Completed lessons have distinct visual treatment
 * - Accessible: keyboard navigable, labelled buttons
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
      className={`lesson-item ${completed ? "lesson-item--completed" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      aria-label={`Lesson ${order}: ${title}${completed ? " (completed)" : ""}`}
    >
      <div className="lesson-item__number" aria-hidden="true">
        {completed ? (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          order
        )}
      </div>

      <button
        className="lesson-item__title"
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        tabIndex={-1}
        aria-hidden="true"
      >
        {title}
      </button>

      {completed && (
        <span className="lesson-item__check" aria-hidden="true">
          ✓
        </span>
      )}

      {!completed && onComplete && (
        <button
          className="lesson-item__complete-btn"
          onClick={(e) => {
            e.stopPropagation();
            onComplete();
          }}
          aria-label={`Mark ${title} as complete`}
        >
          Mark complete
        </button>
      )}
    </li>
  );
}