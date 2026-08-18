import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useSession } from "../lib/useSession";

function isSyntheticLineEmail(email: string | undefined): boolean {
  return /^line\+[^@]+@users\.noreply\.gather\.wedopr\.com$/i.test(email?.trim() ?? "");
}

export default function PasswordSettingsPage() {
  const navigate = useNavigate();
  const { session, loading } = useSession();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const syntheticLineIdentity = isSyntheticLineEmail(session?.user.email);

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

  async function handleEmailBinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailNotice(null);
    setEmailError(null);
    const normalizedEmail = newEmail.trim().toLowerCase();
    const currentEmail = session?.user.email?.trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailError("請輸入要綁定的 email");
      return;
    }
    if (normalizedEmail === currentEmail) {
      setEmailError("這就是目前的登入 email，請直接用它登入");
      return;
    }

    setEmailBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser(
        { email: normalizedEmail },
        { emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}account/password` },
      );
      if (updateError) throw updateError;
      setEmailNotice(`確認信已寄到 ${normalizedEmail}。完成確認後，它才會成為新的登入 email。`);
      setNewEmail("");
    } catch {
      setEmailError("這個 email 無法綁定，可能已被其他帳號使用；請改用其他 email，或先用該帳號登入。");
    } finally {
      setEmailBusy(false);
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
      <h1>{syntheticLineIdentity ? "完成登入設定" : "設定登入密碼"}</h1>
      <p className="auth-intro">
        {syntheticLineIdentity
          ? "請先綁定自己的 email 並完成確認；確認完成後，再設定密碼，之後就能用自己的 email＋密碼登入。LINE 與 email 驗證碼登入仍然保留。"
          : "設定後，你可以用目前帳號的 email 與密碼登入；LINE 與 email 驗證碼登入仍然保留。"}
      </p>

      <div className="card account-login-email">
        <p className="eyebrow">目前登入身份</p>
        <p className="account-login-email__value">{session.user.email ?? "尚未提供登入 email"}</p>
        <p className="hint">
          {syntheticLineIdentity
            ? "這是 LINE 建立的系統登入身份，不是你平常使用的 email；請先在下方綁定自己的 email，再用自己的 email＋密碼登入。"
            : "之後使用 email＋密碼登入時，請填這個 email。它可能和 LINE 帳號或公開顯示資料中的 email 不同。"}
        </p>
      </div>

      {error && <div className="banner banner--error" role="alert">{error}</div>}
      {notice && <div className="banner banner--success" role="status">{notice}</div>}

      {syntheticLineIdentity && (
        <div className="banner banner--success" role="status">
          目前是 LINE 系統身份；完成下方 email 確認前，不能用這個 `line+…` 地址收信登入。
        </div>
      )}

      <form className="stack card" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="new-password">{syntheticLineIdentity ? "確認 Email 後設定新密碼" : "新密碼"}</label>
          <div className="password-field">
            <input
              id="new-password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={syntheticLineIdentity}
              required
            />
            <button
              type="button"
              className="password-toggle"
              aria-label={showPassword ? "隱藏密碼" : "顯示密碼"}
              onClick={() => setShowPassword((visible) => !visible)}
              disabled={syntheticLineIdentity}
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
            disabled={syntheticLineIdentity}
            required
          />
        </div>
        <div className="actions">
          <button type="submit" className="btn-primary auth-action" disabled={busy || syntheticLineIdentity}>
            {syntheticLineIdentity ? "完成 Email 確認後設定" : busy ? "儲存中…" : "儲存登入密碼"}
          </button>
          <Link className="btn-text" to="/">返回首頁</Link>
        </div>
      </form>

      <form className="stack card account-email-binding" onSubmit={handleEmailBinding}>
        <div>
          <p className="eyebrow">登入 email</p>
          <h2>綁定自己的 email</h2>
          <p className="hint">
            系統會寄確認信到新 email。你完成信件確認前，目前登入 email 不會改變；確認後才可用新 email＋目前密碼登入。
            若系統要求確認原本與新的 email，請依信件指示完成兩次確認。
          </p>
        </div>
        {emailError && <div className="banner banner--error" role="alert">{emailError}</div>}
        {emailNotice && <div className="banner banner--success" role="status">{emailNotice}</div>}
        <div className="field">
          <label htmlFor="new-login-email">新的登入 email</label>
          <input
            id="new-login-email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
            placeholder="name@example.com"
            required
          />
        </div>
        <div className="actions">
          <button type="submit" className="btn-secondary" disabled={emailBusy}>
            {emailBusy ? "寄送中…" : "寄送確認信"}
          </button>
        </div>
      </form>
    </div>
  );
}
