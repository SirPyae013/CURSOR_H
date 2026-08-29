import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStats } from "../api.js";
import Stat from "../components/Stat.jsx";

export default function Home() {
  const [stats, setStats] = useState({ donations: 12, organizations: 4, needs: 18 });

  useEffect(() => {
    getStats()
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div>
      <section className="mx-auto max-w-6xl px-5 py-16 md:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-teal">AI-powered donation matching</p>
        <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
          Turn what you have into what someone needs.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-ink/70">
          Describe the items you can give. ImpactMatch matches them to organizations by
          compatibility, urgency, quantity, and location — so your donation goes where it
          helps most.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/donate" className="rounded-lg bg-teal px-6 py-3 font-semibold text-white hover:bg-teal-dark">
            Donate now
          </Link>
          <Link to="/organizations" className="rounded-lg border border-ink/10 bg-white px-6 py-3 font-semibold hover:border-teal">
            Find organizations
          </Link>
          <Link to="/dashboard" className="rounded-lg px-6 py-3 font-semibold text-teal hover:underline">
            For organizations
          </Link>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <Stat value={stats.donations} label="Donations matched" />
          <Stat value={stats.organizations} label="Organizations" />
          <Stat value={stats.needs} label="Items needed" />
        </div>
      </section>
    </div>
  );
}
