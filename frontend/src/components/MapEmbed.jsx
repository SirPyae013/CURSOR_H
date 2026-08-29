export default function MapEmbed({ src, title = "Organization location" }) {
  if (!src) return null;
  return (
    <div className="overflow-hidden rounded-lg border border-ink/10 bg-cream/40">
      <iframe
        title={title}
        src={src}
        className="h-56 w-full border-0"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        allowFullScreen
      />
    </div>
  );
}

export function previewMapUrl(address, location) {
  const query = [address, location].map((part) => (part || "").trim()).filter(Boolean).join(", ");
  if (!query) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}
