import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getStats } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import Stat from "../components/Stat.jsx";

export default function Home() {
  const { hasOrganization } = useAuth();
  const [stats, setStats] = useState({ donations: 12, organizations: 4, needs: 18 });
  // #region agent log
  fetch('http://127.0.0.1:7393/ingest/f8ef1ea3-d3d8-40b6-b1b6-f8e700f400a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ade5c2'},body:JSON.stringify({sessionId:'ade5c2',runId:'pre-fix',hypothesisId:'C',location:'Home.jsx:render',message:'home render',data:{hasOrganization:Boolean(hasOrganization),stats},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  useEffect(() => {
    getStats()
      .then((data) => {
        // #region agent log
        fetch('http://127.0.0.1:7393/ingest/f8ef1ea3-d3d8-40b6-b1b6-f8e700f400a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ade5c2'},body:JSON.stringify({sessionId:'ade5c2',runId:'pre-fix',hypothesisId:'A',location:'Home.jsx:getStats.then',message:'stats fetch ok',data:{keys:data&&Object.keys(data),donations:data?.donations,organizations:data?.organizations,needs:data?.needs,api:import.meta.env.VITE_API_URL||'default-8000'},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        setStats(data);
      })
      .catch((err) => {
        // #region agent log
        fetch('http://127.0.0.1:7393/ingest/f8ef1ea3-d3d8-40b6-b1b6-f8e700f400a3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'ade5c2'},body:JSON.stringify({sessionId:'ade5c2',runId:'pre-fix',hypothesisId:'A',location:'Home.jsx:getStats.catch',message:'stats fetch failed',data:{error:String(err?.message||err),status:err?.status||null},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
      });
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
        </div>
        <p className="mt-4 text-sm text-ink/55">
          Represent a school or shelter?{" "}
          <Link
            to={hasOrganization ? "/dashboard" : "/organization/setup"}
            className="font-semibold text-teal hover:underline"
          >
            For organizations
          </Link>
        </p>
        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          <Stat
            value={stats.donations}
            icon="gift"
            to="/donate"
            label="Donations we helped place"
            detail="Items people already gave that we matched to a charity."
          />
          <Stat
            value={stats.organizations}
            icon="building"
            to="/organizations"
            label="Charities you can help"
            detail="Groups listed here that accept donations."
          />
          <Stat
            value={stats.needs}
            icon="box"
            to="/organizations"
            label="Things orgs still need"
            detail="Open item requests waiting for a donor."
          />
        </div>
      </section>
    </div>
  );
}
