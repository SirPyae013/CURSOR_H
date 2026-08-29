import { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { getNotifications, markNotificationRead } from "../api.js";
import { useAuth } from "../AuthContext.jsx";

export default function Layout({ children }) {
  const { ready, isAuthenticated, user, hasOrganization, logout } = useAuth();
  const navigate = useNavigate();
  const orgPath = hasOrganization ? "/dashboard" : "/organization/setup";
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notes, setNotes] = useState({ unread_count: 0, results: [] });

  const links = [
    { to: "/donate", label: "Donate" },
    { to: "/organizations", label: "Organizations" },
    { to: orgPath, label: "For organizations" },
  ];

  async function refreshNotes() {
    if (!isAuthenticated) return;
    try {
      setNotes(await getNotifications());
    } catch {
      setNotes({ unread_count: 0, results: [] });
    }
  }

  useEffect(() => {
    refreshNotes();
  }, [isAuthenticated]);

  async function openNote(note) {
    if (!note.read) {
      try {
        await markNotificationRead(note.id);
      } catch {
        /* ignore */
      }
    }
    setBellOpen(false);
    setMenuOpen(false);
    if (note.link) navigate(note.link);
    refreshNotes();
  }

  const authLinks = ready && isAuthenticated
    ? [
        { to: "/profile", label: user?.name || "Profile" },
      ]
    : [
        { to: "/login", label: "Sign in" },
        { to: "/register", label: "Register" },
      ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link to="/" className="flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-teal text-white text-sm">IM</span>
            <span>ImpactMatch</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-medium md:gap-6">
            {links.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                className={({ isActive }) =>
                  `hidden sm:inline ${isActive ? "text-teal" : "text-ink/70 hover:text-ink"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {authLinks.map((link) => (
              <NavLink
                key={link.label}
                to={link.to}
                className={({ isActive }) =>
                  `hidden sm:inline ${isActive ? "text-teal" : "text-ink/70 hover:text-ink"}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            {ready && isAuthenticated ? (
              <>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setBellOpen((open) => !open);
                      if (!bellOpen) refreshNotes();
                    }}
                    className="relative text-ink/70 hover:text-ink"
                    aria-label="Notifications"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                      <path d="M6 9a6 6 0 1 1 12 0c0 7 2 7 2 9H4c0-2 2-2 2-9" />
                      <path d="M10 20a2 2 0 0 0 4 0" />
                    </svg>
                    {notes.unread_count ? (
                      <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center rounded-full bg-coral px-1 text-[10px] text-white">
                        {notes.unread_count}
                      </span>
                    ) : null}
                  </button>
                  {bellOpen ? (
                    <div className="absolute right-0 mt-2 w-72 rounded-lg bg-white p-3 shadow-card">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink/50">Notifications</p>
                      {notes.results?.length ? (
                        <ul className="mt-2 max-h-72 space-y-2 overflow-auto">
                          {notes.results.map((note) => (
                            <li key={note.id}>
                              <button
                                type="button"
                                onClick={() => openNote(note)}
                                className={`w-full rounded-md px-2 py-2 text-left text-sm ${note.read ? "text-ink/55" : "bg-cream text-ink"}`}
                              >
                                {note.message}
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-2 text-sm text-ink/50">No notifications yet.</p>
                      )}
                    </div>
                  ) : null}
                </div>
                <button type="button" onClick={logout} className="hidden text-ink/70 hover:text-ink sm:inline">
                  Log out
                </button>
              </>
            ) : null}
            <button
              type="button"
              className="sm:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
                {menuOpen ? (
                  <path d="M6 6l12 12M18 6L6 18" />
                ) : (
                  <path d="M4 7h16M4 12h16M4 17h16" />
                )}
              </svg>
            </button>
          </nav>
        </div>
        {menuOpen ? (
          <div className="border-t border-black/5 px-5 py-3 sm:hidden">
            <div className="flex flex-col gap-3 text-sm font-medium">
              {[...links, ...authLinks].map((link) => (
                <NavLink
                  key={link.label}
                  to={link.to}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => (isActive ? "text-teal" : "text-ink/70")}
                >
                  {link.label}
                </NavLink>
              ))}
              {ready && isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className="text-left text-ink/70"
                >
                  Log out
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-black/5 py-8 text-center text-sm text-ink/50">
        ImpactMatch — match what you have with who needs it most.
      </footer>
    </div>
  );
}
