import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const next = location.state?.next || new URLSearchParams(location.search).get("next") || "/";
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    location: "",
    become_receiver: false,
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function onChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      navigate(form.become_receiver ? "/organization/setup" : next, { replace: true });
    } catch (err) {
      setError(err.message || "Could not create this account.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-5 py-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-teal">Join ImpactMatch</p>
      <h1 className="mt-2 text-3xl font-extrabold">Create an account</h1>
      <p className="mt-2 text-ink/65">
        One account can donate and later represent an organization.
      </p>
      <form onSubmit={onSubmit} className="card mt-8 space-y-4 p-6">
        <label className="block text-sm font-semibold">
          Full name
          <input
            required
            name="name"
            value={form.name}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          Email
          <input
            required
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          Password
          <input
            required
            minLength={8}
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
          />
        </label>
        <label className="block text-sm font-semibold">
          City
          <input
            name="location"
            value={form.location}
            onChange={onChange}
            placeholder="Mandalay"
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="become_receiver"
            checked={form.become_receiver}
            onChange={onChange}
            className="mt-1"
          />
          <span>I also represent an organization and want to build its profile.</span>
        </label>
        {error ? <p className="text-sm text-coral">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-teal py-2.5 font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        >
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="mt-4 text-sm text-ink/65">
        Already have an account?{" "}
        <Link to="/login" state={{ next }} className="font-semibold text-teal">
          Sign in
        </Link>
      </p>
    </div>
  );
}
