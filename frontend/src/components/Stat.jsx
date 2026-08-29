export default function Stat({ value, label }) {
  return (
    <div className="card px-6 py-5 text-center">
      <div className="text-3xl font-extrabold text-teal">{value}</div>
      <div className="mt-1 text-sm text-ink/60">{label}</div>
    </div>
  );
}
