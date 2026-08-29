import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getMyDonations } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

export default function Profile() {
  const { user, saveProfile } = useAuth();
  const [form, setForm] = useState({
    name: user?.name || "",
    location: user?.location || "",
    phone: user?.phone || "",
  });
  const [donations, setDonations] = useState([]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setForm({
      name: user?.name || "",
      location: user?.location || "",
      phone: user?.phone || "",
    });
  }, [user]);

  useEffect(() => {
    getMyDonations()
      .then(setDonations)
      .catch((err) => setError(err.message));
  }, []);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setSaved("");
    setBusy(true);
    try {
      await saveProfile(form);
      setSaved("Profile saved.");
    } catch (err) {
      setError(err.message || "Could not save profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-teal">Your account</p>
      <h1 className="mt-2 text-3xl font-extrabold">Profile</h1>
      <p className="mt-2 text-ink/65">
        Roles: {(user?.roles || []).join(" · ") || "donor"}. Guest donations stay public; signed-in
        donations are saved here.
      </p>

      <form onSubmit={onSubmit} className="card mt-8 grid gap-4 p-6 md:grid-cols-2">
        <label className="text-sm font-semibold md:col-span-2">
          Name
          <input
            required
            name="name"
            value={form.name}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          City
          <input
            name="location"
            value={form.location}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Phone
          <input
            name="phone"
            value={form.phone}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2 font-normal"
          />
        </label>
        <p className="text-sm text-ink/50 md:col-span-2">{user?.email}</p>
        {error ? <p className="text-sm text-coral md:col-span-2">{error}</p> : null}
        {saved ? <p className="text-sm text-teal md:col-span-2">{saved}</p> : null}
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save profile"}
          </button>
        </div>
      </form>

      <h2 className="mt-10 text-lg font-bold">Donation history</h2>
      {donations.length === 0 ? (
        <p className="mt-3 text-sm text-ink/60">
          No saved donations yet.{" "}
          <Link to="/donate" className="font-semibold text-teal">
            Donate now
          </Link>
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {donations.map((donation) => (
            <Link
              key={donation.id}
              to={`/results/${donation.id}`}
              className="card block p-5 hover:ring-1 hover:ring-teal/30"
            >
              <p className="text-sm text-ink/50">
                {new Date(donation.created_at).toLocaleDateString()} · {donation.location} ·{" "}
                <span className="font-semibold capitalize text-ink/70">{donation.status || "open"}</span>
              </p>
              <p className="mt-1 font-medium">{donation.description}</p>
              {donation.chosen_match ? (
                <p className="mt-2 text-sm text-teal">
                  {donation.chosen_match.status === "pledged" ? "Pledged to" : "Matched with"}{" "}
                  {donation.chosen_match.organization.name} ({donation.chosen_match.score}%)
                </p>
              ) : donation.top_match ? (
                <p className="mt-2 text-sm text-teal">
                  Best match: {donation.top_match.organization.name} ({donation.top_match.score}%)
                </p>
              ) : null}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
