import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.next || new URLSearchParams(location.search).get("next") || "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message || "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-teal">Welcome back</p>
      <h1 className="mt-2 text-3xl font-extrabold">Sign in</h1>
      <p className="mt-2 text-ink/65">
        Use your ImpactMatch account to save donations or manage an organization.
      </p>
      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
        <label className="block text-sm font-semibold">
          Email
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
          />
        </label>
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-teal py-2.5 font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink/65">
        New here?{" "}
        <Link to="/register" state={{ next }} className="font-semibold text-teal">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-xs text-ink/45">
        Demo organization: hello@brightfuture.mm / demo1234
      </p>
    </div>
  );
}
