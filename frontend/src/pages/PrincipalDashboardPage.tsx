import { useEffect, useState } from "react";
import { apiGet } from "../services/api";
import TopBar from "../components/TopBar";

type ClassData = {
  id: number;
  name: string;
  total_students: number;
  pass_rate: number;
};

type TeacherData = {
  id: number;
  username: string;
};

export default function PrincipalDashboardPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<TeacherData[]>([]);

  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingTeachers, setLoadingTeachers] = useState(true);

  useEffect(() => {
    Promise.allSettled([
      apiGet<ClassData[]>("/academics/sections/").then((d) => { setClasses(d || []); setLoadingClasses(false); }),
      apiGet<TeacherData[]>("/accounts/teachers/").then((d) => { setTeachers(d || []); setLoadingTeachers(false); }),
    ]);
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: 24 }}>
      <TopBar title="Principal Dashboard" />

      <h2>Your Classes</h2>
      {loadingClasses ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[...Array(4)].map((_, i) => <div key={i} style={{ height: 140, background: "#f0f0f0", borderRadius: 8 }} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {classes.map((c) => (
            <div key={c.id} style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8 }}>
              <h4>Class {c.name}</h4>
              <p>Students: {c.total_students}</p>
              <p>Pass Rate: {c.pass_rate}%</p>
            </div>
          ))}
        </div>
      )}

      <h2 style={{ marginTop: 40 }}>Your Teachers</h2>
      {loadingTeachers ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {[...Array(3)].map((_, i) => <div key={i} style={{ height: 100, background: "#f0f0f0", borderRadius: 8 }} />)}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
          {teachers.map((t) => (
            <div key={t.id} style={{ border: "1px solid #ddd", padding: 20, borderRadius: 8 }}>
              <h4>{t.username}</h4>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}