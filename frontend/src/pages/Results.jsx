import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getDonationMatches, pledgeMatch } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import ImpactGrid from "../components/ImpactGrid.jsx";
import ScoreRing from "../components/ScoreRing.jsx";
import UrgencyBadge from "../components/UrgencyBadge.jsx";

const statusLabel = {
  strong: "Strong match",
  partial: "Partial match",
  none: "No match",
};

const matchStatusStyles = {
  suggested: "bg-cream text-ink/70",
  pledged: "bg-gold/20 text-amber-800",
  accepted: "bg-teal-light text-teal-dark",
  declined: "bg-coral/15 text-coral",
  delivered: "bg-teal text-white",
};

function MatchStatus({ status }) {
  if (!status || status === "suggested") return null;
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${matchStatusStyles[status] || matchStatusStyles.suggested}`}>
      {status}
    </span>
  );
}

export default function Results() {
  const { donationId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { isAuthenticated } = useAuth();
  const preferredOrgId = Number(location.state?.preferredOrgId || searchParams.get("org") || 0) || null;
  const [data, setData] = useState(location.state || null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (location.state) return;
    getDonationMatches(donationId, preferredOrgId ? { org: preferredOrgId } : {})
      .then(setData)
      .catch((err) => {
        if (err.status === 403) {
          navigate("/login", {
            replace: true,
            state: { next: `/results/${donationId}${preferredOrgId ? `?org=${preferredOrgId}` : ""}` },
          });
          return;
        }
        setError(err.message);
      });
  }, [donationId, location.state, navigate, preferredOrgId]);

  const matches = useMemo(() => {
    const rows = [...(data?.matches || [])];
    if (!preferredOrgId) return rows;
    const preferred = rows.find((row) => row.organization.id === preferredOrgId);
    if (!preferred) return rows;
    return [preferred, ...rows.filter((row) => row.organization.id !== preferredOrgId)];
  }, [data, preferredOrgId]);

  const [best, ...others] = matches;
  const pledged = matches.find((row) => ["pledged", "accepted", "delivered"].includes(row.status));
  const canSwitch = !pledged || pledged.status === "pledged";

  async function onPledge(match) {
    if (!isAuthenticated) {
      navigate("/login", {
        state: { next: `/results/${donationId}${preferredOrgId ? `?org=${preferredOrgId}` : ""}` },
      });
      return;
    }
    setError("");
    setBusyId(match.id);
    try {
      await pledgeMatch(match.id);
      const next = await getDonationMatches(donationId, preferredOrgId ? { org: preferredOrgId } : {});
      setData(next);
    } catch (err) {
      if (err.status === 401) {
        navigate("/login", {
          state: { next: `/results/${donationId}${preferredOrgId ? `?org=${preferredOrgId}` : ""}` },
        });
        return;
      }
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  if (error && !data) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-coral">{error}</p>;
  }
  if (!data) {
    return <p className="mx-auto max-w-3xl px-5 py-16 text-ink/50">Loading matches…</p>;
  }
  if (!best) {
    return <p className="mx-auto max-w-3xl px-5 py-16">No organizations to match yet.</p>;
  }

  const preferred = preferredOrgId && best.organization.id === preferredOrgId;
  const pledgeLabel = `Pledge to ${best.organization.name}`;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="text-sm font-semibold uppercase tracking-wider text-teal">
        {preferred ? "Matching toward this organization" : "Best match"}
      </p>
      {error ? <p className="mt-3 text-sm text-coral">{error}</p> : null}
      {data.donation?.status && data.donation.status !== "open" ? (
        <p className="mt-3 text-sm text-ink/60">
          Donation status: <span className="font-semibold capitalize">{data.donation.status}</span>
        </p>
      ) : null}
      <div className="card mt-4 p-6 md:flex md:items-center md:gap-8 md:p-8">
        <ScoreRing score={best.score} size={132} />
        <div className="mt-4 flex-1 md:mt-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-extrabold">{best.organization.name}</h1>
            <MatchStatus status={best.status} />
          </div>
          <p className="mt-1 text-ink/60">{best.organization.location}</p>
          <div className="mt-3">
            <UrgencyBadge urgency={best.highest_urgency} />
          </div>
          <p className="mt-4 text-ink/75">{best.reason}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {isAuthenticated ? (
              canSwitch && best.status !== "accepted" && best.status !== "delivered" ? (
                <button
                  type="button"
                  disabled={busyId === best.id || best.status === "pledged"}
                  onClick={() => onPledge(best)}
                  className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
                >
                  {best.status === "pledged" ? "Pledged" : busyId === best.id ? "Pledging…" : pledgeLabel}
                </button>
              ) : null
            ) : (
              <Link
                to="/login"
                state={{ next: `/results/${donationId}${preferredOrgId ? `?org=${preferredOrgId}` : ""}` }}
                className="rounded-lg bg-teal px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark"
              >
                Sign in to pledge
              </Link>
            )}
            <Link
              to={`/organizations/${best.organization.id}`}
              className="rounded-lg border border-ink/10 px-5 py-2.5 text-sm font-semibold"
            >
              View organization
            </Link>
          </div>
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
              <div key={match.organization.id} className="card p-5">
                <div className="flex items-center gap-4">
                  <ScoreRing score={match.score} size={84} />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-bold">{match.organization.name}</div>
                      <MatchStatus status={match.status} />
                    </div>
                    <div className="text-sm text-ink/55">{match.organization.location}</div>
                    <div className="mt-2">
                      <UrgencyBadge urgency={match.highest_urgency} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-3">
                  {isAuthenticated && canSwitch && match.status !== "accepted" && match.status !== "delivered" ? (
                    <button
                      type="button"
                      disabled={busyId === match.id || match.status === "pledged"}
                      onClick={() => onPledge(match)}
                      className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
                    >
                      {match.status === "pledged" ? "Pledged" : `Pledge to ${match.organization.name}`}
                    </button>
                  ) : null}
                  <Link to={`/organizations/${match.organization.id}`} className="text-sm font-semibold text-teal">
                    View organization
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
