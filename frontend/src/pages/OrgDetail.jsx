import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { claimOrganization, getOrganization } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import MapEmbed from "../components/MapEmbed.jsx";
import NeedList from "../components/NeedList.jsx";

export default function OrgDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, isReceiver, hasOrganization, refreshMe } = useAuth();
  const [org, setOrg] = useState(null);
  const [error, setError] = useState("");
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    getOrganization(id)
      .then(setOrg)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error && !org) return <p className="mx-auto max-w-3xl px-5 py-16 text-coral">{error}</p>;
  if (!org) return <p className="mx-auto max-w-3xl px-5 py-16 text-ink/50">Loading…</p>;

  const mail = `mailto:${org.contact_email}?subject=${encodeURIComponent("Donation via ImpactMatch")}`;
  const canClaim = isAuthenticated && isReceiver && !hasOrganization && !org.has_owner;

  async function onClaim() {
    setError("");
    setClaiming(true);
    try {
      const next = await claimOrganization(org.id);
      setOrg(next);
      await refreshMe();
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-12">
      {org.image_url ? (
        <img
          src={org.image_url}
          alt=""
          className="h-56 w-full rounded-lg object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : null}
      <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-teal">
        {org.location}
        {org.address ? ` · ${org.address}` : ""}
      </p>
      <h1 className="mt-1 text-3xl font-extrabold">{org.name}</h1>
      <p className="mt-4 text-ink/75">{org.description}</p>
      {org.map_embed_url ? (
        <div className="mt-6">
          <MapEmbed src={org.map_embed_url} title={`${org.name} location`} />
        </div>
      ) : null}
      {!org.has_owner ? (
        <p className="mt-3 text-sm text-ink/55">This organization does not have an owner yet.</p>
      ) : null}

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Current needs</h2>
        <NeedList needs={org.needs} />
      </div>

      {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}

      <div className="card mt-8 p-6">
        <h2 className="font-bold">Contact</h2>
        <p className="mt-1 text-sm">{org.contact_email}</p>
        <p className="text-sm text-ink/60">{org.contact_phone}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={mail} className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-dark">
            Contact organization
          </a>
          <Link
            to={`/donate?org=${org.id}`}
            className="rounded-lg border border-ink/10 px-5 py-2.5 font-semibold"
          >
            Match a donation
          </Link>
          {canClaim ? (
            <button
              type="button"
              disabled={claiming}
              onClick={onClaim}
              className="rounded-lg border border-teal px-5 py-2.5 font-semibold text-teal disabled:opacity-60"
            >
              {claiming ? "Claiming…" : "Claim this organization"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
