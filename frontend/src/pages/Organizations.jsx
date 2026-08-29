import { useEffect, useState } from "react";
import { getOrganizations } from "../api.js";
import OrgCard from "../components/OrgCard.jsx";

const CITIES = ["", "Mandalay", "Yangon", "Naypyidaw"];
const CATEGORIES = [
  "",
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

export default function Organizations() {
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ q: "", location: "", category: "" });
  const [draft, setDraft] = useState({ q: "", location: "", category: "" });

  useEffect(() => {
    getOrganizations(filters)
      .then(setOrgs)
      .catch((err) => setError(err.message));
  }, [filters]);

  function onSubmit(event) {
    event.preventDefault();
    setFilters({ ...draft });
  }

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-extrabold">Organizations</h1>
      <p className="mt-2 max-w-2xl text-ink/65">
        Charities, schools, and community groups currently publishing what they need.
      </p>
      <form onSubmit={onSubmit} className="mt-6 flex flex-wrap gap-3">
        <input
          value={draft.q}
          onChange={(e) => setDraft((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Search name or story"
          className="min-w-[200px] flex-1 rounded-lg border border-ink/10 px-3 py-2"
        />
        <select
          value={draft.location}
          onChange={(e) => setDraft((prev) => ({ ...prev, location: e.target.value }))}
          className="rounded-lg border border-ink/10 px-3 py-2"
        >
          {CITIES.map((city) => (
            <option key={city || "all"} value={city}>
              {city || "All cities"}
            </option>
          ))}
        </select>
        <select
          value={draft.category}
          onChange={(e) => setDraft((prev) => ({ ...prev, category: e.target.value }))}
          className="rounded-lg border border-ink/10 px-3 py-2"
        >
          {CATEGORIES.map((cat) => (
            <option key={cat || "all"} value={cat}>
              {cat ? cat.replace("_", " ") : "All categories"}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-teal px-4 py-2 font-semibold text-white">
          Filter
        </button>
      </form>
      {error ? <p className="mt-6 text-coral">{error}</p> : null}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {orgs.map((org) => (
          <OrgCard key={org.id} org={org} />
        ))}
      </div>
      {!error && orgs.length === 0 ? (
        <p className="mt-6 text-sm text-ink/50">No organizations match those filters.</p>
      ) : null}
    </div>
  );
}
