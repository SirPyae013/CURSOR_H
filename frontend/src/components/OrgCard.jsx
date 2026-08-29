import { Link } from "react-router-dom";
import UrgencyBadge from "./UrgencyBadge.jsx";

export default function OrgCard({ org }) {
  const topUrgency = (org.needs || []).some((n) => n.urgency === "high")
    ? "high"
    : (org.needs || []).some((n) => n.urgency === "medium")
      ? "medium"
      : "low";
  return (
    <Link to={`/organizations/${org.id}`} className="card block overflow-hidden hover:-translate-y-0.5 hover:shadow-lg transition">
      {org.image_url ? (
        <img
          src={org.image_url}
          alt=""
          className="h-36 w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="h-36 bg-teal-light" />
      )}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{org.name}</h3>
            <p className="text-sm text-ink/55">{org.location}</p>
          </div>
          <UrgencyBadge urgency={topUrgency} />
        </div>
        <p className="mt-3 line-clamp-3 text-sm text-ink/70">{org.description}</p>
        <p className="mt-3 text-xs font-medium text-teal">{(org.needs || []).length} open needs</p>
      </div>
    </Link>
  );
}
