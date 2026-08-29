import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function RequireAuth({ children }) {
  const { ready, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!ready) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-ink/50">Loading…</p>;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ next: location.pathname }} />;
  }
  return children;
}
