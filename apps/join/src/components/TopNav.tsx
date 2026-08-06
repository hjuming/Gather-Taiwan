import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";

export default function TopNav() {
  const { session } = useSession();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  return (
    <nav className="top-nav">
      <Link to="/" className="brand" style={{ textDecoration: "none" }}>
        來聚一場
      </Link>
      <div className="actions" style={{ gap: 16 }}>
        <Link to="/events/new">發起活動</Link>
        {session ? (
          <>
            <Link to="/me/registrations">我的報名</Link>
            <button type="button" className="btn-text" onClick={handleSignOut}>
              登出
            </button>
          </>
        ) : (
          <Link to="/auth">登入</Link>
        )}
      </div>
    </nav>
  );
}
