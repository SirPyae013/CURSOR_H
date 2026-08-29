import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  acceptMatch,
  createNeed,
  declineMatch,
  deleteNeed,
  deliverMatch,
  getInboxMatches,
  getMyOrganization,
  updateNeed,
} from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import UrgencyBadge from "../components/UrgencyBadge.jsx";

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

const emptyForm = {
  item_name: "",
  category: "clothing",
  quantity_needed: 10,
  quantity_received: 0,
  urgency: "medium",
  description: "",
};

export default function Dashboard() {
  const { isReceiver, hasOrganization, refreshMe } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState(null);
  const [inbox, setInbox] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  async function refresh() {
    const [data, matches] = await Promise.all([getMyOrganization(), getInboxMatches().catch(() => [])]);
    setOrg(data);
    setInbox(matches);
    await refreshMe();
  }

  useEffect(() => {
    if (!isReceiver || !hasOrganization) {
      navigate("/organization/setup", { replace: true });
      return;
    }
    refresh().catch((err) => {
      if (err.status === 404) {
        navigate("/organization/setup", { replace: true });
        return;
      }
      setError(err.message);
    });
  }, [isReceiver, hasOrganization, navigate]);

  function onChange(event) {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: name.includes("quantity") ? Number(value) : value,
    }));
  }

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    try {
      if (editingId) {
        await updateNeed(editingId, form);
      } else {
        await createNeed(org.id, form);
      }
      setForm(emptyForm);
      setEditingId(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function onDelete(id) {
    await deleteNeed(id);
    await refresh();
  }

  async function onInboxAction(match, action) {
    setError("");
    setBusyId(match.id);
    try {
      if (action === "accept") await acceptMatch(match.id);
      if (action === "decline") await declineMatch(match.id);
      if (action === "deliver") await deliverMatch(match.id);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  function onEdit(need) {
    setEditingId(need.id);
    setForm({
      item_name: need.item_name,
      category: need.category,
      quantity_needed: need.quantity_needed,
      quantity_received: need.quantity_received,
      urgency: need.urgency,
      description: need.description || "",
    });
  }

  if (!org) {
    return <p className="mx-auto max-w-5xl px-5 py-16 text-ink/50">Loading dashboard…</p>;
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      {org.image_url ? (
        <img
          src={org.image_url}
          alt=""
          className="mb-6 h-44 w-full rounded-lg object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <h1 className="text-3xl font-extrabold">Organization dashboard</h1>
      <p className="mt-2 text-ink/65">
        Update live needs so donors can be matched to what {org.name} actually requires right now.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <p className="text-sm font-semibold">
          {org.name} — {org.location}
          {org.address ? ` · ${org.address}` : ""}
        </p>
        <Link to="/organization/setup" className="text-sm font-semibold text-teal">
          Edit profile
        </Link>
      </div>

      {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}

      <section className="mt-8">
        <h2 className="text-lg font-bold">Inbox</h2>
        <p className="mt-1 text-sm text-ink/60">Incoming pledges for {org.name}. Accepting updates received quantities.</p>
        {inbox.length === 0 ? (
          <p className="mt-3 text-sm text-ink/50">No pledges yet.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {inbox.map((match) => (
              <div key={match.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-teal">
                      <span className="capitalize">{match.status}</span> · {match.score}% match
                    </p>
                    <p className="mt-1 font-medium">{match.donation?.description}</p>
                    <p className="mt-1 text-sm text-ink/55">
                      {match.donation?.donor_name || "Guest"} · {match.donation?.location}
                    </p>
                    <ul className="mt-2 text-sm text-ink/70">
                      {(match.donation?.items || []).map((item) => (
                        <li key={item.id || item.item_name}>
                          {item.quantity} × {item.item_name}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {match.status === "pledged" ? (
                      <>
                        <button
                          type="button"
                          disabled={busyId === match.id}
                          onClick={() => onInboxAction(match, "accept")}
                          className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={busyId === match.id}
                          onClick={() => onInboxAction(match, "decline")}
                          className="rounded-lg border border-ink/10 px-4 py-2 text-sm font-semibold disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </>
                    ) : null}
                    {match.status === "accepted" ? (
                      <button
                        type="button"
                        disabled={busyId === match.id}
                        onClick={() => onInboxAction(match, "deliver")}
                        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        Mark delivered
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 overflow-x-auto card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-black/5 text-ink/50">
            <tr>
              <th className="px-4 py-3 font-medium">Item</th>
              <th className="px-4 py-3 font-medium">Needed</th>
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Remaining</th>
              <th className="px-4 py-3 font-medium">Urgency</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {(org.needs || []).map((need) => (
              <tr key={need.id} className="border-b border-black/5 last:border-0">
                <td className="px-4 py-3 font-medium">{need.item_name}</td>
                <td className="px-4 py-3">{need.quantity_needed}</td>
                <td className="px-4 py-3">{need.quantity_received}</td>
                <td className="px-4 py-3 font-semibold">{need.remaining}</td>
                <td className="px-4 py-3">
                  <UrgencyBadge urgency={need.urgency} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="mr-3 text-teal" onClick={() => onEdit(need)}>
                    Edit
                  </button>
                  <button className="text-coral" onClick={() => onDelete(need.id)}>
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={onSubmit} className="card mt-8 grid gap-4 p-6 md:grid-cols-2">
        <h2 className="md:col-span-2 text-lg font-bold">
          {editingId ? "Edit need" : "Add a need"}
        </h2>
        <label className="text-sm">
          Item name
          <input
            required
            name="item_name"
            value={form.item_name}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Category
          <select
            name="category"
            value={form.category}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Quantity needed
          <input
            type="number"
            min="0"
            name="quantity_needed"
            value={form.quantity_needed}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Quantity received
          <input
            type="number"
            min="0"
            name="quantity_received"
            value={form.quantity_received}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2"
          />
        </label>
        <label className="text-sm">
          Urgency
          <select
            name="urgency"
            value={form.urgency}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2"
          >
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </label>
        <label className="text-sm md:col-span-2">
          Description
          <input
            name="description"
            value={form.description}
            onChange={onChange}
            className="mt-1 w-full rounded-lg border border-ink/10 px-3 py-2"
          />
        </label>
        <div className="md:col-span-2 flex gap-3">
          <button type="submit" className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white">
            {editingId ? "Save changes" : "Add need"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="rounded-lg px-5 py-2.5"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>
    </div>
  );
}
