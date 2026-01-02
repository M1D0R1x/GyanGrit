import { useEffect, useState } from "react";
import { apiGet } from "./services/api";
import LessonItem from "./components/LessonItem";
import LessonPage from "./pages/LessonPage";

type Course = {
  id: number;
  title: string;
  description: string;
};

type Lesson = {
  id: number;
  title: string;
  order: number;
  content: string;
};

function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    apiGet<Course[]>("/api/courses/").then(setCourses);
  }, []);

  function loadLessons(course: Course) {
    setSelectedCourse(course);
    apiGet<Lesson[]>(`/api/courses/${course.id}/lessons/`)
      .then(setLessons);
  }

  if (activeLesson) {
    return <LessonPage lesson={activeLesson} onBack={() => setActiveLesson(null)} />;
  }

  return (
    <div>
      <h1>GyanGrit</h1>

      {!selectedCourse && (
        <ul>
          {courses.map((c) => (
            <li key={c.id}>
              <button onClick={() => loadLessons(c)}>{c.title}</button>
            </li>
          ))}
        </ul>
      )}

      {selectedCourse && (
        <>
          <h2>{selectedCourse.title}</h2>
          <ul>
            {lessons.map((l) => (
              <LessonItem
                key={l.id}
                id={l.id}
                title={l.title}
                order={l.order}
                onSelect={() => setActiveLesson(l)}
              />
            ))}
          </ul>

          <button onClick={() => setSelectedCourse(null)}>
            Back to courses
          </button>
        </>
      )}
    </div>
  );
}

export default App;
