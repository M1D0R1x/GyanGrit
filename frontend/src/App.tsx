import { useEffect } from "react";
import { apiGet } from "./services/api";

function App() {
  useEffect(() => {
    apiGet("/")
      .then(data => console.log(data))
      .catch(err => console.log("Backend not ready:", err.message));
  }, []);

  return (
    <div>
      <h1>GyanGrit</h1>
      <p>Frontend scaffold running</p>
    </div>
  );
}

export default App;
