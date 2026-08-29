import { useEffect, useState } from "react";
import { getOrganizations } from "../api.js";
import OrgCard from "../components/OrgCard.jsx";

export default function Organizations() {
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    getOrganizations()
      .then(setOrgs)
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <h1 className="text-3xl font-extrabold">Organizations</h1>
      <p className="mt-2 max-w-2xl text-ink/65">
        Charities, schools, and community groups currently publishing what they need.
      </p>
      {error ? <p className="mt-6 text-coral">{error}</p> : null}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {orgs.map((org) => (
          <OrgCard key={org.id} org={org} />
        ))}
      </div>
    </div>
  );
}
