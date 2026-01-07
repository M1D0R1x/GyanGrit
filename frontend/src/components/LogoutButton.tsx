import { useNavigate } from "react-router-dom";
import { apiLogout } from "../services/api";
import { useAuth } from "../auth/AuthContext";

export default function LogoutButton() {
  const navigate = useNavigate();
  const auth = useAuth();

  async function handleLogout() {
    await apiLogout();
    await auth.refresh(); // ✅ clean reset
    navigate("/login");
  }

  return <button onClick={handleLogout}>Logout</button>;
}
