import UrgencyBadge from "./UrgencyBadge.jsx";

export default function NeedList({ needs = [] }) {
  if (!needs.length) {
    return <p className="text-sm text-ink/50">No open needs right now.</p>;
  }
  return (
    <div className="space-y-3">
      {needs.map((need) => (
        <div key={need.id || need.item_name} className="flex items-start justify-between gap-4 rounded-lg border border-black/5 bg-cream/60 px-4 py-3">
          <div>
            <div className="font-semibold">{need.item_name}</div>
            <div className="text-sm text-ink/60">
              Needed {need.quantity_needed} · Received {need.quantity_received} · Remaining {need.remaining}
            </div>
          </div>
          <UrgencyBadge urgency={need.urgency} />
        </div>
      ))}
    </div>
  );
}
