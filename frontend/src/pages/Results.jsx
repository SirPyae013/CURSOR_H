import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getDonationMatches } from "../api.js";
import ImpactGrid from "../components/ImpactGrid.jsx";
import ScoreRing from "../components/ScoreRing.jsx";
import UrgencyBadge from "../components/UrgencyBadge.jsx";

const statusLabel = {
  strong: "Strong match",
  partial: "Partial match",
  none: "No match",
};

export default function Results() {
  const { donationId } = useParams();
  const location = useLocation();
  const [data, setData] = useState(location.state || null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (location.state) return;
    getDonationMatches(donationId)
      .then(setData)
      .catch((err) => setError(err.message));
  }, [donationId, location.state]);

  if (error) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-coral">{error}</p>;
  }
  if (!data) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-ink/50">Loading matches…</p>;
  }

  const [best, ...others] = data.matches || [];
  if (!best) {
    return <p className="mx-auto max-w-3xl px-5 py-16">No organizations to match yet.</p>;
  }

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-teal">Best match</p>
      <div className="card mt-4 p-6 md:flex md:items-center md:gap-8 md:p-8">
        <ScoreRing score={best.score} size={132} />
        <div className="mt-4 flex-1 md:mt-0">
          <h1 className="text-3xl font-extrabold">{best.organization.name}</h1>
          <p className="mt-1 text-ink/60">{best.organization.location}</p>
          <div className="mt-3">
            <UrgencyBadge urgency={best.highest_urgency} />
          </div>
          <p className="mt-4 text-ink/75">{best.reason}</p>
          <Link
            to={`/organizations/${best.organization.id}`}
            className="mt-5 inline-block rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
          >
            View organization
          </Link>
        </div>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <h2 className="font-bold">Matching items</h2>
          <ul className="mt-4 space-y-3">
            {(best.item_matches || []).map((row) => (
              <li key={row.item_name} className="flex items-center justify-between text-sm">
                <span>
                  {row.status === "strong" ? "✓" : row.status === "partial" ? "•" : "×"}{" "}
                  {row.item_name}
                  {row.need_name ? <span className="text-ink/45"> → {row.need_name}</span> : null}
                </span>
                <span className="font-medium text-teal">{statusLabel[row.status] || row.status}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-6">
          <h2 className="font-bold">Why this score</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink/70">
            <li>Item / need fit · {Math.round((best.breakdown?.item || 0) * 100)}%</li>
            <li>Urgency · {Math.round((best.breakdown?.urgency || 0) * 100)}%</li>
            <li>Location · {Math.round((best.breakdown?.location || 0) * 100)}%</li>
            <li>Quantity · {Math.round((best.breakdown?.quantity || 0) * 100)}%</li>
          </ul>
        </div>
      </div>

      <div className="mt-8">
        <ImpactGrid impact={best.impact} />
      </div>

      {others.length ? (
        <div className="mt-12">
          <h2 className="text-xl font-bold">Other matches</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {others.map((match) => (
              <Link
                key={match.organization.id}
                to={`/organizations/${match.organization.id}`}
                className="card flex items-center gap-4 p-5 hover:-translate-y-0.5 transition"
              >
                <ScoreRing score={match.score} size={84} />
                <div>
                  <div className="font-bold">{match.organization.name}</div>
                  <div className="text-sm text-ink/55">{match.organization.location}</div>
                  <div className="mt-2">
                    <UrgencyBadge urgency={match.highest_urgency} />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
