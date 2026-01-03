type Props = {
  id: number;
  title: string;
  order: number;
  onSelect: () => void;
  onComplete?: () => void;
};

export default function LessonItem({
  title,
  order,
  onSelect,
  onComplete,
}: Props) {
  return (
    <li>
      <button onClick={onSelect}>
        {order}. {title}
      </button>

      {onComplete && (
        <button
          onClick={onComplete}
          style={{ marginLeft: "8px" }}
        >
          ✓ Complete
        </button>
      )}
    </li>
  );
}
