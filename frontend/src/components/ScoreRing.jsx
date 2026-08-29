export default function ScoreRing({ score = 0, size = 112 }) {
  const radius = 42;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (Math.min(100, Math.max(0, score)) / 100) * circ;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#E8E2D6" strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#0F6C5B"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-2xl font-extrabold leading-none">{score}%</div>
          <div className="text-[10px] uppercase tracking-wider text-ink/50">Match</div>
        </div>
      </div>
    </div>
  );
}
