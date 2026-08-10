import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";

export default function TopNav() {
  const { session } = useSession();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const touchNav = typeof navigator !== "undefined" && navigator.maxTouchPoints > 0;

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    closeMenu();
    navigate("/");
  }

  return (
    <nav className={`top-nav${touchNav ? " touch-nav" : ""}`}>
      <div className="brand-lockup">
        <a href="/" className="brand brand--site" onClick={closeMenu}>
          聚場台灣
          <span>Gather Taiwan</span>
        </a>
        <span className="brand-divider" aria-hidden="true">/</span>
        <Link to="/" className="brand brand--tool" onClick={closeMenu}>
          來聚一場
        </Link>
      </div>
      <button
        type="button"
        className="menu-toggle"
        aria-expanded={menuOpen}
        aria-controls="top-nav-menu"
        aria-label={menuOpen ? "關閉選單" : "開啟選單"}
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true" className="menu-toggle__icon">
          {menuOpen ? "×" : "☰"}
        </span>
      </button>
      <div id="top-nav-menu" className={`actions top-nav-menu${menuOpen ? " is-open" : ""}`} style={{ gap: 16 }}>
        <a href="/gatherings/" onClick={closeMenu}>
          聚場地圖
        </a>
        <NavLink to="/events/new" onClick={closeMenu}>
          發起一場聚會
        </NavLink>
        {session ? (
          <>
            <NavLink to="/me/hosting" onClick={closeMenu}>
              我發起的聚會
            </NavLink>
            <NavLink to="/me/registrations" onClick={closeMenu}>
              我的報名
            </NavLink>
            <button type="button" className="btn-text" onClick={handleSignOut}>
              登出
            </button>
          </>
        ) : (
          <Link to="/auth" onClick={closeMenu}>
            登入
          </Link>
        )}
      </div>
    </nav>
  );
}
