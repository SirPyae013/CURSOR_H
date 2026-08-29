import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOrganization } from "../api.js";
import NeedList from "../components/NeedList.jsx";

export default function OrgDetail() {
  const { id } = useParams();
  const [org, setOrg] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getOrganization(id)
      .then(setOrg)
      .catch((err) => setError(err.message));
  }, [id]);

  if (error) return <p className="mx-auto max-w-3xl px-5 py-16 text-coral">{error}</p>;
  if (!org) return <p className="mx-auto max-w-3xl px-5 py-16 text-ink/50">Loading…</p>;

  const accepted = [...new Set((org.needs || []).map((n) => n.category.replace(/_/g, " ")))];
  const mail = `mailto:${org.contact_email}?subject=${encodeURIComponent("Donation via ImpactMatch")}`;

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
      <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-teal">{org.location}</p>
      <h1 className="mt-1 text-3xl font-extrabold">{org.name}</h1>
      <p className="mt-4 text-ink/75">{org.description}</p>

      <div className="mt-8">
        <h2 className="mb-3 text-lg font-bold">Current needs</h2>
        <NeedList needs={org.needs} />
      </div>

      <div className="card mt-8 p-6">
        <h2 className="font-bold">What they accept</h2>
        <p className="mt-2 text-sm capitalize text-ink/70">{accepted.join(" · ") || "See current needs"}</p>
        <h2 className="mt-5 font-bold">Contact</h2>
        <p className="mt-1 text-sm">{org.contact_email}</p>
        <p className="text-sm text-ink/60">{org.contact_phone}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={mail} className="rounded-lg bg-teal px-5 py-2.5 font-semibold text-white hover:bg-teal-dark">
            Contact organization
          </a>
          <Link to="/donate" className="rounded-lg border border-ink/10 px-5 py-2.5 font-semibold">
            Match a donation
          </Link>
        </div>
      </div>
    </div>
  );
}
