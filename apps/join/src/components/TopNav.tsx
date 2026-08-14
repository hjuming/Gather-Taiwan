import { useEffect, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";

export default function TopNav() {
  const { session } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("nav-open", menuOpen);
    return () => document.body.classList.remove("nav-open");
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.search]);

  function closeMenu() {
    setMenuOpen(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    closeMenu();
    navigate("/");
  }

  return (
    <nav className="top-nav" aria-label="主要導覽">
      <div className="top-nav-inner">
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
          <span aria-hidden="true" className="menu-toggle__bar" />
          <span aria-hidden="true" className="menu-toggle__bar" />
          <span aria-hidden="true" className="menu-toggle__bar" />
        </button>
        {menuOpen && (
          <button
            type="button"
            className="top-nav-backdrop"
            aria-label="關閉導覽選單"
            onClick={closeMenu}
          />
        )}
        <div
          id="top-nav-menu"
          className={`top-nav-menu${menuOpen ? " is-open" : ""}`}
          aria-hidden={!menuOpen}
        >
          <p className="top-nav-menu__eyebrow">來聚一場</p>
          <a href="/" onClick={closeMenu}>
            回到聚場台灣
          </a>
          <a href="/gatherings/" onClick={closeMenu}>
            聚場地圖
          </a>
          <NavLink to="/events/new" onClick={closeMenu}>
            發起一場聚會
          </NavLink>
          {session && (
            <>
              <NavLink to="/me/hosting" onClick={closeMenu}>
                我發起的聚會
              </NavLink>
              <NavLink to="/account/password" onClick={closeMenu}>
                設定登入密碼
              </NavLink>
              <button type="button" className="btn-text" onClick={handleSignOut}>
                登出
              </button>
            </>
          )}
          <NavLink
            to={session ? "/me/registrations" : "/auth?redirect=%2Fme%2Fregistrations"}
            onClick={closeMenu}
          >
            我的報名
          </NavLink>
          {!session && (
            <Link to="/auth" onClick={closeMenu}>
              登入
            </Link>
          )}
          <a href="/contact/" onClick={closeMenu}>
            聯絡我們
          </a>
          <p className="drawer-note">從一張桌開始，走進台灣人熟悉的味道、城市與相聚故事。</p>
        </div>
      </div>
    </nav>
  );
}
