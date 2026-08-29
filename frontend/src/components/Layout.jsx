import { Link, NavLink } from "react-router-dom";
import { useAuth } from "../AuthContext.jsx";

export default function Layout({ children }) {
  const { ready, isAuthenticated, user, hasOrganization, logout } = useAuth();
  const orgPath = hasOrganization ? "/dashboard" : "/organization/setup";

  const links = [
    { to: "/donate", label: "Donate" },
    { to: "/organizations", label: "Organizations" },
    { to: orgPath, label: "For organizations" },
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
            {ready && isAuthenticated ? (
              <>
                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    `hidden sm:inline ${isActive ? "text-teal" : "text-ink/70 hover:text-ink"}`
                  }
                >
                  {user?.name || "Profile"}
                </NavLink>
                <button type="button" onClick={logout} className="text-ink/70 hover:text-ink">
                  Log out
                </button>
              </>
            ) : (
              <>
                <NavLink
                  to="/login"
                  className={({ isActive }) =>
                    `hidden sm:inline ${isActive ? "text-teal" : "text-ink/70 hover:text-ink"}`
                  }
                >
                  Sign in
                </NavLink>
                <NavLink
                  to="/register"
                  className={({ isActive }) =>
                    `hidden sm:inline ${isActive ? "text-teal" : "text-ink/70 hover:text-ink"}`
                  }
                >
                  Register
                </NavLink>
              </>
            )}
            <Link
              to="/donate"
              className="rounded-lg bg-teal px-4 py-2 text-white shadow-sm hover:bg-teal-dark"
            >
              Donate now
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-black/5 py-8 text-center text-sm text-ink/50">
        ImpactMatch — match what you have with who needs it most.
      </footer>
    </div>
  );
}
