import { useNavigate } from "react-router-dom";
import { apiLogout } from "../services/api";

export default function LogoutButton() {
  const navigate = useNavigate();

  async function handleLogout() {
    await apiLogout();
    navigate("/login");
    window.location.reload(); // force AuthContext reset
  }

  return (
    <button onClick={handleLogout}>
      Logout
    </button>
  );
}
