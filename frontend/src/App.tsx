import { useEffect, useState } from "react";
import { apiGet } from "./services/api";

type Course = {
  id: number;
  title: string;
  description: string;
};

function App() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Course[]>("/api/courses/")
      .then(setCourses)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1>GyanGrit</h1>

      {error && <p>Error: {error}</p>}

      <ul>
        {courses.map((c) => (
          <li key={c.id}>
            <strong>{c.title}</strong>
            <p>{c.description}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
