import { useEffect, useState } from "react";
import { apiGet } from "./services/api";

function App() {
  const [status, setStatus] = useState<string>("loading");

  useEffect(() => {
    apiGet("/api/health/")
      .then((data) => setStatus(data.status))
      .catch((err) => {
        console.error(err);
        setStatus("backend unreachable");
      });
  }, []);

  return (
    <div>
      <h1>GyanGrit</h1>
      <p>Backend status: {status}</p>
    </div>
  );
}

export default App;
