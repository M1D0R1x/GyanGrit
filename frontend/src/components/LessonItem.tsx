import { useEffect, useState } from "react";
import { getLessonProgress } from "../services/progress";
import type { LessonProgress } from "../services/progress";

type Props = {
  id: number;
  title: string;
  order: number;
  onSelect: () => void;
};

export default function LessonItem({ id, title, order, onSelect }: Props) {
  const [progress, setProgress] = useState<LessonProgress | null>(null);

  useEffect(() => {
    getLessonProgress(id).then(setProgress);
  }, [id]);

  return (
    <li>
      <button onClick={onSelect}>
        {order}. {title}
        {progress && (
          <span>
            {" "}
            — {progress.completed ? "✅ Completed" : "⏳ In progress"}
          </span>
        )}
      </button>
    </li>
  );
}
