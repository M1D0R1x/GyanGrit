type Props = {
  id: number;
  title: string;
  order: number;
  onSelect: () => void;
};

export default function LessonItem({ title, order, onSelect }: Props) {
  return (
    <li>
      <button onClick={onSelect}>
        {order}. {title}
      </button>
    </li>
  );
}
