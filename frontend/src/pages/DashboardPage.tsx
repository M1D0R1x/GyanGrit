import { useEffect, useState } from "react";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type StudentSubject = {
  id: number;
  name: string;
  total_lessons: number;
  completed_lessons: number;
  progress: number;
};

export default function DashboardPage() {
  const [subjects, setSubjects] = useState<StudentSubject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await apiGet<StudentSubject[]>(
          "/academics/subjects/"
        );
        setSubjects(data || []);
      } catch (err) {
        console.error("Failed to load student subjects:", err);
        setError("Failed to load dashboard data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <TopBar title="Student Dashboard" />

      {loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                height: 160,
                background: "#f0f0f0",
                borderRadius: 8,
                animation: "pulse 1.5s infinite",
              }}
            />
          ))}
        </div>
      ) : error ? (
        <div style={{ color: "red", textAlign: "center", padding: 40 }}>
          <p>{error}</p>
        </div>
      ) : (
        <>
          <h2>Your Subjects</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            {subjects.length === 0 ? (
              <p>No subjects enrolled yet.</p>
            ) : (
              subjects.map((subject) => (
                <div
                  key={subject.id}
                  style={{
                    border: "1px solid #ddd",
                    padding: 20,
                    borderRadius: 8,
                    background: "#f9f9f9",
                  }}
                >
                  <h4>{subject.name}</h4>
                  <p style={{ margin: "8px 0" }}>
                    {subject.completed_lessons} / {subject.total_lessons} lessons completed
                  </p>
                  <p style={{ fontWeight: "bold" }}>
                    {subject.progress}% progress
                  </p>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}