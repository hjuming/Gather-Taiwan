import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";

export default function PasswordSettingsPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session) {
      navigate(`/auth?redirect=${encodeURIComponent("/account/password")}`, { replace: true });
    }
  }, [loading, navigate, session]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    if (password.length < 8) {
      setError("密碼至少需要 8 個字元");
      return;
    }
    if (password !== confirmation) {
      setError("兩次輸入的密碼不一致");
      return;
    }

    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmation("");
      setNotice("登入密碼已設定，之後可以用 email 與密碼登入。");
    } catch {
      setError("密碼設定失敗，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !session) {
    return (
      <div className="page">
        <p className="eyebrow">帳號設定</p>
        <p>載入中…</p>
      </div>
    );
  }

  return (
    <div className="page">
      <p className="eyebrow">帳號設定</p>
      <h1>設定登入密碼</h1>
      <p className="auth-intro">
        設定後，你可以用目前帳號的 email 與密碼登入；LINE 與 email 驗證碼登入仍然保留。
      </p>

      {error && <div className="banner banner--error" role="alert">{error}</div>}
      {notice && <div className="banner banner--success" role="status">{notice}</div>}

      <form className="stack card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="new-password">新密碼</label>
          <div className="password-field">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
              onClick={() => setShowPassword((visible) => !visible)}
            >
              {showPassword ? "隱藏" : "顯示"}
            </button>
          </div>
          <p className="hint">至少 8 個字元，請避免使用容易猜到的資訊。</p>
        </div>
        <div className="field">
          <label htmlFor="confirm-password">再次輸入新密碼</label>
          <input
            id="confirm-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </div>
        <div className="actions">
          <button type="submit" className="btn-primary auth-action" disabled={busy}>
            {busy ? "儲存中…" : "儲存登入密碼"}
          </button>
          <Link className="btn-text" to="/">返回首頁</Link>
        </div>
      </form>
    </div>
  );
}
