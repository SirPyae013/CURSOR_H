import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { analyzeDonation, extractDonationItems, getOrganization } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import AnalyzeOverlay from "../components/AnalyzeOverlay.jsx";

const EXAMPLES = [
  {
    label: "Mandalay shirts & textbooks",
    text: "I have 20 children's shirts, 10 middle-school textbooks, and 15 notebooks.",
  },
  {
    label: "Yangon blankets",
    text: "I can donate 12 warm blankets and 8 adult jackets in Yangon.",
  },
  {
    label: "School supplies",
    text: "A box of 40 notebooks, 20 pencil cases, and 15 children's shoes.",
  },
];
const DESC_LIMIT = 800;
const CITIES = ["Mandalay", "Yangon", "Naypyidaw"];
const CATEGORIES = [
  "clothing",
  "education",
  "school_supplies",
  "food",
  "hygiene",
  "toys",
  "household",
  "shoes",
  "blankets",
  "other",
];

function emptyItem() {
  return { item_name: "", category: "other", quantity: 1 };
}

export default function Donate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orgId = searchParams.get("org");
  const { isAuthenticated, user } = useAuth();
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState(user?.location || "Mandalay");
  const [targetOrg, setTargetOrg] = useState(null);
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!orgId) return;
    getOrganization(orgId)
      .then(setTargetOrg)
      .catch(() => setTargetOrg(null));
  }, [orgId]);

  useEffect(() => {
    if (!analyzing) return undefined;
    setStep(0);
    const timers = [0, 1, 2, 3].map((index) =>
      setTimeout(() => setStep(index + 1), 400 * (index + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, [analyzing]);

  function updateItem(index, field, value) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  async function onExtract(event) {
    event.preventDefault();
    setError("");
    setExtracting(true);
    try {
      const result = await extractDonationItems({ description });
      setItems(result.items?.length ? result.items : [emptyItem()]);
    } catch (err) {
      setError(err.message || "Could not extract items.");
    } finally {
      setExtracting(false);
    }
  }

  async function onAnalyze(event) {
    event.preventDefault();
    setError("");
    const cleaned = (items || []).filter((item) => item.item_name.trim());
    if (!cleaned.length) {
      setError("Add at least one item before matching.");
      return;
    }
    setAnalyzing(true);
    const started = Date.now();
    try {
      const payload = {
        description,
        location,
        items: cleaned.map((item) => ({
          item_name: item.item_name,
          category: item.category,
          quantity: Number(item.quantity) || 1,
          condition: item.condition || null,
          intended_users: item.intended_users || "",
        })),
      };
      if (orgId) payload.organization_id = Number(orgId);
      const result = await analyzeDonation(payload);
      const wait = Math.max(0, 1800 - (Date.now() - started));
      await new Promise((resolve) => setTimeout(resolve, wait));
      const path = orgId ? `/results/${result.donation.id}?org=${orgId}` : `/results/${result.donation.id}`;
      navigate(path, { state: { ...result, preferredOrgId: orgId ? Number(orgId) : null } });
    } catch (err) {
      setError(err.message || "Could not analyze this donation.");
      setAnalyzing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <AnalyzeOverlay visible={analyzing} step={step} />
      <p className="text-sm font-semibold uppercase tracking-wider text-teal">Donor</p>
      <h1 className="mt-2 text-3xl font-extrabold">What can you give today?</h1>
      <p className="mt-2 text-ink/65">
        Write it the way you would tell a friend. We’ll extract the items so you can edit them
        before we find matches.
        {isAuthenticated ? (
          <span> This donation will be saved to your profile.</span>
        ) : (
          <span>
            {" "}
            Guests can donate.{" "}
            <Link to="/login" state={{ next: "/donate" }} className="font-semibold text-teal">
              Sign in
            </Link>{" "}
            to pledge a match and keep a history.
          </span>
        )}
      </p>
      {targetOrg ? (
        <div className="mt-4 rounded-lg border border-teal/20 bg-teal/5 px-4 py-3 text-sm">
          Matching toward <span className="font-semibold">{targetOrg.name}</span>. We’ll still
          score every organization and highlight this one on your results.
        </div>
      ) : null}

      <form onSubmit={items ? onAnalyze : onExtract} className="card mt-8 p-6 md:p-8">
        <label className="text-sm font-semibold" htmlFor="donation-description">
          Donation description
        </label>
        <p className="mt-1 text-sm text-ink/55">
          Include item names, quantities, and who they’re for. We’ll turn this into an editable list
          before matching.
        </p>
        <textarea
          id="donation-description"
          required
          rows={8}
          maxLength={DESC_LIMIT}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. 20 children’s shirts, 10 middle-school textbooks, and a box of notebooks in Mandalay"
          className="mt-3 min-h-[180px] w-full resize-y rounded-xl border border-ink/10 bg-cream/40 px-4 py-3 text-base leading-relaxed outline-none transition focus:border-teal focus:bg-white focus:ring-2 focus:ring-teal/25"
        />
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink/45">Try an example to see the extract flow.</p>
          <p className={`text-xs tabular-nums ${description.length >= DESC_LIMIT ? "text-coral" : "text-ink/45"}`}>
            {description.length}/{DESC_LIMIT}
          </p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((example) => (
            <button
              type="button"
              key={example.label}
              onClick={() => setDescription(example.text)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                description === example.text
                  ? "border-teal bg-teal text-white"
                  : "border-ink/10 bg-cream text-ink/70 hover:border-teal/40 hover:text-teal"
              }`}
            >
              {example.label}
            </button>
          ))}
        </div>
        <label className="mt-5 block text-sm font-semibold">Your city</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CITIES.map((city) => (
            <button
              type="button"
              key={city}
              onClick={() => setLocation(city)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                location === city ? "bg-teal text-white" : "bg-cream text-ink/70"
              }`}
            >
              {city}
            </button>
          ))}
        </div>

        {items ? (
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">Extracted items</h2>
              <button
                type="button"
                className="text-sm font-semibold text-teal"
                onClick={() => setItems((prev) => [...prev, emptyItem()])}
              >
                Add item
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {items.map((item, index) => (
                <div key={index} className="grid gap-2 rounded-lg border border-ink/10 p-3 md:grid-cols-12">
                  <input
                    required
                    value={item.item_name}
                    onChange={(e) => updateItem(index, "item_name", e.target.value)}
                    placeholder="Item name"
                    className="rounded-lg border border-ink/10 px-3 py-2 md:col-span-6"
                  />
                  <select
                    value={item.category}
                    onChange={(e) => updateItem(index, "category", e.target.value)}
                    className="rounded-lg border border-ink/10 px-3 py-2 md:col-span-3"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace("_", " ")}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(index, "quantity", Number(e.target.value) || 1)}
                    className="rounded-lg border border-ink/10 px-3 py-2 md:col-span-2"
                  />
                  <button
                    type="button"
                    className="text-sm text-coral md:col-span-1"
                    onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 rounded-lg border border-dashed border-ink/15 bg-cream/50 px-4 py-3 text-sm text-ink/50">
          Image matching coming soon — optional photo upload is disabled for this MVP.
        </div>
        {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
        <div className="mt-6 flex flex-wrap gap-3">
          {items ? (
            <>
              <button
                type="submit"
                disabled={analyzing}
                className="rounded-lg bg-teal px-5 py-3 font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
              >
                Find matches
              </button>
              <button
                type="button"
                className="rounded-lg px-5 py-3 font-semibold text-ink/70"
                onClick={() => setItems(null)}
              >
                Edit description
              </button>
            </>
          ) : (
            <button
              type="submit"
              disabled={extracting}
              className="w-full rounded-lg bg-teal py-3 font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
            >
              {extracting ? "Extracting items…" : "Extract items"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
