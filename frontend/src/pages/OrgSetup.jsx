import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createMyOrganization, getMyOrganization, updateMyOrganization } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

const empty = {
  name: "",
  location: "",
  description: "",
  contact_email: "",
  contact_phone: "",
  image_url: "",
};

const STEPS = [
  { title: "Basics", fields: ["name", "location"] },
  { title: "Story", fields: ["description"] },
  { title: "Contact", fields: ["contact_email", "contact_phone", "image_url"] },
  { title: "Review", fields: [] },
];

export default function OrgSetup() {
  const { user, enableReceiver, refreshMe, isReceiver } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...empty, contact_email: user?.email || "" });
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      try {
        if (!isReceiver) await enableReceiver();
        const org = await getMyOrganization().catch((err) => {
          if (err.status === 404) return null;
          throw err;
        });
        if (cancelled) return;
        if (org) {
          setEditing(true);
          setForm({
            name: org.name || "",
            location: org.location || "",
            description: org.description || "",
            contact_email: org.contact_email || "",
            contact_phone: org.contact_phone || "",
            image_url: org.image_url || "",
          });
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    boot();
    return () => {
      cancelled = true;
    };
    // Run once on mount so enabling receiver does not retrigger the builder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function validateStep(index) {
    if (index === 0 && (!form.name.trim() || !form.location.trim())) {
      return "Name and location are required.";
    }
    if (index === 1 && !form.description.trim()) {
      return "Please describe the organization.";
    }
    if (index === 2 && !form.contact_email.trim()) {
      return "Contact email is required.";
    }
    return "";
  }

  function nextStep() {
    const message = validateStep(step);
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  }

  async function onPublish(event) {
    event.preventDefault();
    const message = validateStep(0) || validateStep(1) || validateStep(2);
    if (message) {
      setError(message);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const payload = { ...form };
      if (editing) {
        await updateMyOrganization(payload);
      } else {
        await createMyOrganization(payload);
      }
      await refreshMe();
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Could not save the organization.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-ink/50">Loading organization profile…</p>;
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-teal">
        {editing ? "Edit organization" : "Organization profile"}
      </p>
      <h1 className="mt-2 text-3xl font-extrabold">
        {editing ? "Update your public profile" : "Build your organization profile"}
      </h1>
      <p className="mt-2 text-ink/65">
        Step {step + 1} of {STEPS.length}: {STEPS[step].title}
      </p>
      <div className="mt-4 flex gap-2">
        {STEPS.map((item, index) => (
          <div
            key={item.title}
            className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-teal" : "bg-ink/10"}`}
          />
        ))}
      </div>

      <form onSubmit={onPublish} className="card mt-8 space-y-4 p-6">
        {step === 0 ? (
          <>
            <label className="block text-sm font-semibold">
              Organization name
              <input
                required
                name="name"
                value={form.name}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              City
              <input
                required
                name="location"
                value={form.location}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
              />
            </label>
          </>
        ) : null}

        {step === 1 ? (
          <label className="block text-sm font-semibold">
            Story
            <textarea
              required
              rows={6}
              name="description"
              value={form.description}
              onChange={onChange}
              className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
            />
          </label>
        ) : null}

        {step === 2 ? (
          <>
            <label className="block text-sm font-semibold">
              Contact email
              <input
                required
                type="email"
                name="contact_email"
                value={form.contact_email}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Phone
              <input
                name="contact_phone"
                value={form.contact_phone}
                onChange={onChange}
                className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
              />
            </label>
            <label className="block text-sm font-semibold">
              Image URL
              <input
                name="image_url"
                value={form.image_url}
                onChange={onChange}
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
              />
            </label>
          </>
        ) : null}

        {step === 3 ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold">Name:</span> {form.name}
            </p>
            <p>
              <span className="font-semibold">Location:</span> {form.location}
            </p>
            <p className="text-ink/75">{form.description}</p>
            <p>
              <span className="font-semibold">Email:</span> {form.contact_email}
            </p>
            <p>
              <span className="font-semibold">Phone:</span> {form.contact_phone || "—"}
            </p>
            {form.image_url ? (
              <img src={form.image_url} alt="" className="h-36 w-full rounded-lg object-cover" />
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-coral">{error}</p> : null}

        <div className="flex flex-wrap gap-3">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => {
                setError("");
                setStep((prev) => prev - 1);
              }}
              className="rounded-lg px-5 py-2.5 font-semibold"
            >
              Back
            </button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={nextStep}
              className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-dark"
            >
              Continue
            </button>
          ) : (
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
            >
              {busy ? "Saving…" : editing ? "Save changes" : "Publish profile"}
            </button>
          )}
          {editing ? (
            <Link to="/dashboard" className="rounded-lg px-5 py-2.5 font-semibold">
              Cancel
            </Link>
          ) : null}
        </div>
      </form>
    </div>
  );
}
