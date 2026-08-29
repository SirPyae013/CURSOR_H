const icons = ["👕", "📚", "📓", "🧸", "🍞", "🧼", "👟", "🧺"];

export default function ImpactGrid({ impact = [] }) {
  if (!impact.length) return null;
  return (
    <div>
      <h3 className="mb-3 text-lg font-bold">Your donation could help</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        {impact.map((item, index) => (
          <div key={`${item.label}-${index}`} className="card px-4 py-4">
            <div className="text-2xl">{icons[index % icons.length]}</div>
            <div className="mt-2 text-2xl font-extrabold text-teal">{item.count}</div>
            <div className="text-sm text-ink/65">{item.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
