import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { analyzeDonation } from "../api.js";
import { useAuth } from "../AuthContext.jsx";
import AnalyzeOverlay from "../components/AnalyzeOverlay.jsx";

const DEMO =
  "I have 20 children's shirts, 10 middle-school textbooks, and 15 notebooks.";
const CITIES = ["Mandalay", "Yangon", "Naypyidaw"];

export default function Donate() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [description, setDescription] = useState(DEMO);
  const [location, setLocation] = useState(user?.location || "Mandalay");
  const [error, setError] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!analyzing) return undefined;
    setStep(0);
    const timers = [0, 1, 2, 3].map((index) =>
      setTimeout(() => setStep(index + 1), 400 * (index + 1))
    );
    return () => timers.forEach(clearTimeout);
  }, [analyzing]);

  async function onSubmit(event) {
    event.preventDefault();
    setError("");
    setAnalyzing(true);
    const started = Date.now();
    try {
      const result = await analyzeDonation({ description, location });
      const wait = Math.max(0, 1800 - (Date.now() - started));
      await new Promise((resolve) => setTimeout(resolve, wait));
      navigate(`/results/${result.donation.id}`, { state: result });
    } catch (err) {
      setError(err.message || "Could not analyze this donation.");
      setAnalyzing(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <AnalyzeOverlay visible={analyzing} step={step} />
      <p className="text-sm font-semibold uppercase tracking-wider text-teal">Donor</p>
      <h1 className="mt-2 text-3xl font-extrabold">What can you give today?</h1>
      <p className="mt-2 text-ink/65">
        Write it the way you would tell a friend. We’ll extract the items and find the
        strongest organizational matches.
        {isAuthenticated ? (
          <span> This donation will be saved to your profile.</span>
        ) : (
          <span>
            {" "}
            Guests can donate.{" "}
            <Link to="/login" state={{ next: "/donate" }} className="font-semibold text-teal">
              Sign in
            </Link>{" "}
            to keep a history.
          </span>
        )}
      </p>
      <form onSubmit={onSubmit} className="card mt-8 p-6 md:p-8">
        <label className="text-sm font-semibold">Donation description</label>
        <textarea
          required
          rows={6}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-2 w-full rounded-lg border border-ink/10 bg-cream/40 px-4 py-3 outline-none focus:border-teal"
        />
        <label className="mt-5 block text-sm font-semibold">Your city</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {CITIES.map((city) => (
            <button
              type="button"
              key={city}
              onClick={() => setLocation(city)}
              className={`rounded-full px-4 py-2 text-sm font-medium ${
                location === city ? "bg-teal text-white" : "bg-cream text-ink/70"
              }`}
            >
              {city}
            </button>
          ))}
        </div>
        <div className="mt-5 rounded-lg border border-dashed border-ink/15 bg-cream/50 px-4 py-3 text-sm text-ink/50">
          Image matching coming soon — optional photo upload is disabled for this MVP.
        </div>
        {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
        <button
          type="submit"
          disabled={analyzing}
          className="mt-6 w-full rounded-lg bg-teal py-3 font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
        >
          Find my best match
        </button>
      </form>
    </div>
  );
}
