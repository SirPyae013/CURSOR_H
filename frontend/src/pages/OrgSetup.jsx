import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createMyOrganization, getMyOrganization, updateMyOrganization } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import MapEmbed, { previewMapUrl } from "../components/MapEmbed.jsx";

const empty = {
  name: "",
  location: "",
  address: "",
  description: "",
  contact_email: "",
  contact_phone: "",
  image_url: "",
};

const PHOTO_PRESETS = [
  {
    label: "Classroom",
    url: "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1200&q=80",
  },
  {
    label: "Community",
    url: "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?w=1200&q=80",
  },
  {
    label: "Shelter",
    url: "https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?w=1200&q=80",
  },
  {
    label: "Schoolyard",
    url: "https://images.unsplash.com/photo-1588072432836-e10032774350?w=1200&q=80",
  },
  {
    label: "Volunteers",
    url: "https://images.unsplash.com/photo-1559027615-cd4628902d4a?w=1200&q=80",
  },
  {
    label: "Supplies",
    url: "https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?w=1200&q=80",
  },
  {
    label: "Children",
    url: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=80",
  },
  {
    label: "Kitchen",
    url: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=1200&q=80",
  },
];

const STEPS = [
  { title: "Basics", fields: ["name", "location", "address"] },
  { title: "Story", fields: ["description"] },
  { title: "Contact", fields: ["contact_email", "contact_phone"] },
  { title: "Photo", fields: [] },
  { title: "Review", fields: [] },
];

export default function OrgSetup() {
  const { user, enableReceiver, refreshMe, isReceiver } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ ...empty, contact_email: user?.email || "" });
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [nameChangeCount, setNameChangeCount] = useState(0);
  const [imageFile, setImageFile] = useState(null);
  const [localPreview, setLocalPreview] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const nameLocked = editing && nameChangeCount >= 1;
  const previewSrc = localPreview || form.image_url;
  const mapSrc = previewMapUrl(form.address, form.location);

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
          setNameChangeCount(org.name_change_count || 0);
          setForm({
            name: org.name || "",
            location: org.location || "",
            address: org.address || "",
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

  useEffect(() => {
    return () => {
      if (localPreview) URL.revokeObjectURL(localPreview);
    };
  }, [localPreview]);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  function choosePreset(url) {
    if (localPreview) URL.revokeObjectURL(localPreview);
    setLocalPreview("");
    setImageFile(null);
    setForm((prev) => ({ ...prev, image_url: url }));
  }

  function onUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (localPreview) URL.revokeObjectURL(localPreview);
    setImageFile(file);
    setLocalPreview(URL.createObjectURL(file));
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
        await updateMyOrganization(payload, imageFile);
      } else {
        await createMyOrganization(payload, imageFile);
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
                readOnly={nameLocked}
                className={`mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal ${
                  nameLocked ? "bg-cream/70 text-ink/70" : ""
                }`}
              />
            </label>
            {nameLocked ? (
              <p className="text-xs text-ink/55">
                This name can no longer be edited. Organizations may rename only once.
              </p>
            ) : (
              <p className="text-xs text-ink/55">You can rename this organization once.</p>
            )}
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
            <label className="block text-sm font-semibold">
              Street address
              <input
                name="address"
                value={form.address}
                onChange={onChange}
                placeholder="Optional — used for the map"
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
          </>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-semibold">Choose a profile photo</p>
              <p className="mt-1 text-sm text-ink/55">
                Pick a preset, upload a file, or paste an image URL.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PHOTO_PRESETS.map((preset) => {
                const selected = !localPreview && form.image_url === preset.url;
                return (
                  <button
                    type="button"
                    key={preset.url}
                    onClick={() => choosePreset(preset.url)}
                    className={`overflow-hidden rounded-lg border-2 text-left ${
                      selected ? "border-teal ring-2 ring-teal/25" : "border-transparent"
                    }`}
                  >
                    <img src={preset.url} alt={preset.label} className="h-20 w-full object-cover" />
                    <span className="block px-2 py-1 text-xs font-medium text-ink/70">{preset.label}</span>
                  </button>
                );
              })}
            </div>
            <label className="block text-sm font-semibold">
              Upload a photo
              <input
                type="file"
                accept="image/*"
                onChange={onUpload}
                className="mt-1 block w-full text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-teal file:px-3 file:py-2 file:font-semibold file:text-white"
              />
            </label>
            <label className="block text-sm font-semibold">
              Or paste an image URL
              <input
                name="image_url"
                value={form.image_url}
                onChange={(event) => {
                  setImageFile(null);
                  if (localPreview) URL.revokeObjectURL(localPreview);
                  setLocalPreview("");
                  onChange(event);
                }}
                placeholder="https://…"
                className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
              />
            </label>
            {previewSrc ? (
              <img src={previewSrc} alt="" className="h-40 w-full rounded-lg object-cover" />
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg bg-teal-light text-sm text-ink/50">
                No photo selected yet
              </div>
            )}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold">Name:</span> {form.name}
            </p>
            <p>
              <span className="font-semibold">Location:</span> {form.location}
            </p>
            {form.address ? (
              <p>
                <span className="font-semibold">Address:</span> {form.address}
              </p>
            ) : null}
            <p className="text-ink/75">{form.description}</p>
            <p>
              <span className="font-semibold">Email:</span> {form.contact_email}
            </p>
            <p>
              <span className="font-semibold">Phone:</span> {form.contact_phone || "—"}
            </p>
            {previewSrc ? (
              <img src={previewSrc} alt="" className="h-36 w-full rounded-lg object-cover" />
            ) : null}
            <MapEmbed src={mapSrc} title={`${form.name} location`} />
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
