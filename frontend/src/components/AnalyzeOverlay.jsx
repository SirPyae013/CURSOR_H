const STEPS = [
  "Understanding your donation",
  "Identifying items",
  "Checking organization needs",
  "Comparing matches",
  "Calculating impact",
];

export default function AnalyzeOverlay({ visible, step }) {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 px-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-teal">AI matching</p>
        <h2 className="mt-1 text-xl font-extrabold">Finding where this helps most</h2>
        <ul className="mt-6 space-y-3">
          {STEPS.map((label, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${
                    done || active ? "bg-teal text-white" : "bg-cream text-ink/40"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                <span className={done || active ? "font-medium" : "text-ink/45"}>{label}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
