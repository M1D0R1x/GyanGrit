type Lesson = {
  id: number;
  title: string;
  content: string;
};

type Props = {
  lesson: Lesson;
  onBack: () => void;
};

export default function LessonPage({ lesson, onBack }: Props) {
  return (
    <div>
      <button onClick={onBack}>← Back to lessons</button>
      <h2>{lesson.title}</h2>
      <p>{lesson.content || "Lesson content coming soon."}</p>
    </div>
  );
}
