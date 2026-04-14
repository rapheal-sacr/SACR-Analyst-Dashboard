import { useEffect, useState } from "react";
import { NavLink, Route, Routes } from "react-router-dom";

import "./App.css";
import { SacrLogo, useTheme } from "./components";
import { History, TodaysFeed } from "./pages";

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <path d="M18 6L6 18" />
          <path d="M6 6l12 12" />
        </>
      ) : (
        <>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </>
      )}
    </svg>
  );
}

function ThemeIcon({ theme }: { theme: "light" | "dark" }) {
  if (theme === "dark") {
    return (
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 1 0 9.8 9.8Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function App() {
  const { effectiveTheme, toggleMode } = useTheme();
  const nextTheme = effectiveTheme === "dark" ? "light" : "dark";
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNavOpen(false);
      }
    };
    const onPop = () => setNavOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  return (
    <div className="app-layout">
      <div
        className={`sidebar-backdrop ${navOpen ? "sidebar-backdrop--visible" : ""}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        className={`sidebar ${navOpen ? "sidebar--open" : ""}`}
      >
        <div className="sidebar-body">
          <div className="sidebar-brand-row">
            <div className="brand">
              <SacrLogo />
              <div className="brand-wordmark">SACR Cyber Intel</div>
            </div>
            <button
              type="button"
              className="sidebar-close"
              onClick={() => setNavOpen(false)}
              aria-label="Close menu"
            >
              <MenuIcon open />
            </button>
          </div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
              }
              onClick={() => setNavOpen(false)}
            >
              Today&apos;s Feed
            </NavLink>
            <NavLink
              to="/history"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? "sidebar-link-active" : ""}`
              }
              onClick={() => setNavOpen(false)}
            >
              History
            </NavLink>
          </nav>
        </div>

        <button
          type="button"
          className="theme-toggle"
          onClick={toggleMode}
          title={`Switch to ${nextTheme} mode`}
          aria-label={`Switch to ${nextTheme} mode`}
        >
          <ThemeIcon theme={nextTheme} />
          <span className="theme-toggle-label">
            {nextTheme === "light" ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </aside>

      <header className="mobile-header">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={() => setNavOpen((o) => !o)}
          aria-expanded={navOpen}
          aria-controls="app-sidebar"
          aria-label={navOpen ? "Close menu" : "Open menu"}
        >
          <MenuIcon open={navOpen} />
        </button>
        <div className="mobile-header-brand">
          <SacrLogo />
          <span className="mobile-header-wordmark">SACR Cyber Intel</span>
        </div>
      </header>

      <div
        className={`content-shell ${navOpen ? "content-shell--nav-open" : ""}`}
      >
        <main className="content">
          <Routes>
            <Route path="/" element={<TodaysFeed />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
