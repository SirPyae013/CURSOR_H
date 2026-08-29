import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { checkEmail } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

const COMMON_PASSWORDS = new Set([
  "password",
  "password1",
  "password12",
  "12345678",
  "123456789",
  "qwerty",
  "qwerty123",
  "abc12345",
  "letmein",
  "iloveyou",
  "admin123",
  "welcome1",
]);

function passwordIssues(password, { email, name }) {
  const issues = [];
  if (!password) return ["Use at least 8 characters."];
  if (password.length < 8) issues.push("Use at least 8 characters.");
  if (/^\d+$/.test(password)) issues.push("Password cannot be only numbers.");
  if (COMMON_PASSWORDS.has(password.toLowerCase())) issues.push("This password is too common.");
  if (email && password.toLowerCase() === email.trim().toLowerCase()) {
    issues.push("Password cannot match your email.");
  }
  if (name && password.toLowerCase() === name.trim().toLowerCase()) {
    issues.push("Password cannot match your name.");
  }
  return issues;
}

function strengthScore(password, issues) {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  if (issues.length) score = Math.min(score, 1);
  return Math.min(score, 4);
}

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];

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
  const [emailStatus, setEmailStatus] = useState(null);

  const issues = useMemo(
    () => passwordIssues(form.password, { email: form.email, name: form.name }),
    [form.password, form.email, form.name]
  );
  const score = strengthScore(form.password, issues);
  const emailBlocked = Boolean(emailStatus && (!emailStatus.valid || !emailStatus.available));
  const canSubmit = !busy && issues.length === 0 && !emailBlocked && form.email.trim();

  useEffect(() => {
    const email = form.email.trim();
    if (!email) {
      setEmailStatus(null);
      return undefined;
    }
    const timer = setTimeout(() => {
      checkEmail(email)
        .then(setEmailStatus)
        .catch(() => setEmailStatus(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [form.email]);

  function onChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    if (issues.length) {
      setError(issues[0]);
      return;
    }
    if (emailBlocked) {
      setError(
        !emailStatus.valid ? "Enter a valid email address." : "This email is already registered."
      );
      return;
    }
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
        {emailStatus && form.email.trim() ? (
          <div className="space-y-1 text-sm">
            {!emailStatus.valid ? (
              <p className="text-coral">That email does not look valid.</p>
            ) : null}
            {emailStatus.valid && !emailStatus.available ? (
              <p className="text-coral">This email is already registered.</p>
            ) : null}
            {emailStatus.valid && emailStatus.available && !emailStatus.suggestion ? (
              <p className="text-teal">This email is available.</p>
            ) : null}
            {emailStatus.suggestion ? (
              <p className="text-ink/70">
                Did you mean{" "}
                <button
                  type="button"
                  className="font-semibold text-teal"
                  onClick={() => setForm((prev) => ({ ...prev, email: emailStatus.suggestion }))}
                >
                  {emailStatus.suggestion}
                </button>
                ?
              </p>
            ) : null}
          </div>
        ) : null}
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
        {form.password ? (
          <div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-ink/10">
              <div
                className={`h-full transition-all ${
                  score <= 1 ? "bg-coral" : score === 2 ? "bg-gold" : "bg-teal"
                }`}
                style={{ width: `${(score / 4) * 100}%` }}
              />
            </div>
            <p className={`mt-2 text-xs font-semibold ${score <= 1 ? "text-coral" : "text-ink/60"}`}>
              {STRENGTH_LABELS[score]}
            </p>
            {issues.length ? (
              <p className="mt-1 text-sm text-coral">{issues[0]}</p>
            ) : (
              <p className="mt-1 text-xs text-ink/50">Use 8+ characters. Avoid common or personal passwords.</p>
            )}
          </div>
        ) : null}
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
          disabled={!canSubmit}
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
