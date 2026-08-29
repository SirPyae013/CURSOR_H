const styles = {
  high: "bg-coral/15 text-coral",
  medium: "bg-gold/20 text-amber-800",
  low: "bg-teal-light text-teal-dark",
};

export default function UrgencyBadge({ urgency = "medium" }) {
  const key = (urgency || "medium").toLowerCase();
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${styles[key] || styles.medium}`}>
      {key === "high" ? "High urgency" : key === "low" ? "Low urgency" : "Medium urgency"}
    </span>
  );
}
