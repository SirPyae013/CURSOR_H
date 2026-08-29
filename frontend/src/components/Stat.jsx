import { Link } from "react-router-dom";

const icons = {
  gift: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <rect x="4" y="10" width="16" height="10" rx="1.5" />
      <path d="M4 14h16M12 10v10" />
      <path d="M12 10c-2.2-3.4-5.6-3-5.6-1.1 0 1.6 2.4 2.3 5.6 1.1 2.2-3.4 5.6-3 5.6-1.1 0 1.6-2.4 2.3-5.6 1.1Z" />
    </svg>
  ),
  building: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20V8l8-4 8 4v12H4Z" />
      <path d="M10 20v-5h4v5" />
      <path d="M9 11h1.2M13.8 11H15M9 14.5h1.2M13.8 14.5H15" />
    </svg>
  ),
  box: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M3.5 8.5 12 4.5l8.5 4L12 12.5 3.5 8.5Z" />
      <path d="M3.5 8.5v7L12 19.5l8.5-4v-7" />
      <path d="M12 12.5V19.5" />
    </svg>
  ),
};

export default function Stat({ value, label, detail, icon = "gift", to }) {
  // #region agent log
  fetch('http://127.0.0.1:7393/ingest/f8ef1ea3-d3d8-40b6-b1b6-f8e700f400a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ade5c2'},body:JSON.stringify({sessionId:'ade5c2',runId:'pre-fix',hypothesisId:'B',location:'Stat.jsx:render',message:'stat render',data:{value,label,icon,iconOk:Boolean(icons[icon]),to:to||null,valueType:typeof value},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const content = (
    <>
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-teal-light text-teal">
        {icons[icon]}
      </div>
      <div className="mt-4 text-3xl font-extrabold text-teal">{value}</div>
      <div className="mt-1 text-sm font-semibold text-ink">{label}</div>
      {detail ? <p className="mt-1 text-sm leading-snug text-ink/55">{detail}</p> : null}
    </>
  );

  const className =
    "card block px-6 py-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg";

  if (to) {
    return (
      <Link to={to} className={`${className} hover:ring-1 hover:ring-teal/25`}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
