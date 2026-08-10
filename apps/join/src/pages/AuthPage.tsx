import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ensureUserProfile } from "../lib/api";

type Step = "email" | "code";

const LINE_ERROR_LABEL: Record<string, string> = {
  line_declined: "已取消 LINE 登入",
  missing_code_or_state: "LINE 登入回應不完整，請重新嘗試",
  state_mismatch: "登入驗證失敗，請重新嘗試",
  nonce_mismatch: "登入驗證失敗，請重新嘗試",
  audience_mismatch: "登入驗證失敗，請重新嘗試",
  token_exchange_failed: "LINE 登入暫時無法使用，請稍後再試",
  account_provisioning_failed: "LINE 登入暫時無法完成帳號建立，請稍後再試",
};

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/";
  const lineError = searchParams.get("line_error");

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLineLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const response = await fetch("/app/auth/line/authorize", {
        method: "POST",
        body: new URLSearchParams({ redirect: redirectTo }),
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("LINE 登入暫時無法使用，請稍後再試");
      const data = (await response.json()) as { location?: string };
      if (!data.location || !data.location.startsWith("https://access.line.me/")) {
        throw new Error("LINE 登入暫時無法使用，請稍後再試");
      }
      window.location.assign(data.location);
    } catch (err) {
      setError(err instanceof Error ? err.message : "LINE 登入暫時無法使用，請稍後再試");
      setBusy(false);
    }
  }

  async function handleSendCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !displayName.trim()) {
      setError("請填寫 email 與顯示名稱");
      return;
    }
    setBusy(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          // Without this, Supabase falls back to the project's dashboard
          // "Site URL" — which for this project is still the local-dev
          // default (localhost:3000), so the magic-link fallback inside
          // the OTP email 404s for real users. supabase-js auto-detects
          // the #access_token in this URL's hash on load (default
          // detectSessionInUrl: true), so this also makes clicking the
          // email link itself work as a login path, not just the 6-digit
          // code this page actually asks for.
          emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
        },
      });
      if (otpError) throw otpError;
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "驗證信寄送失敗，請稍後再試");
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!code.trim()) {
      setError("請輸入收到的 6 碼驗證碼");
      return;
    }
    setBusy(true);
    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (verifyError) throw verifyError;

      await ensureUserProfile(displayName.trim());
      await supabase.rpc("sync_verified_email");

      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "驗證碼錯誤或已過期");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <p className="eyebrow">來聚一場</p>
      <h1>登入 / 註冊</h1>

      {lineError && (
        <div className="banner banner--error" role="alert">
          {LINE_ERROR_LABEL[lineError] ?? "LINE 登入失敗，請重新嘗試"}
        </div>
      )}
      {error && (
        <div className="banner banner--error" role="alert">
          {error}
        </div>
      )}

      <form
        className="card"
        method="post"
        action="/app/auth/line/authorize"
        onSubmit={handleLineLogin}
        style={{ marginBottom: 20 }}
      >
        <input type="hidden" name="redirect" value={redirectTo} />
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary"
          style={{ display: "block", width: "100%", textAlign: "center" }}
        >
          使用 LINE 登入
        </button>
      </form>

      <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>或使用 email 驗證碼：</p>

      {step === "email" ? (
        <form className="stack card" onSubmit={handleSendCode}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="displayName">顯示名稱</label>
            <input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="其他參加者會看到的名字"
              required
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "寄送中…" : "寄送驗證碼"}
            </button>
          </div>
        </form>
      ) : (
        <form className="stack card" onSubmit={handleVerifyCode}>
          <p className="hint" style={{ color: "var(--muted)" }}>
            驗證信已寄到 <strong style={{ color: "var(--fg)" }}>{email}</strong>
            。信裡如果沒看到 6 碼數字，直接點信裡的連結也可以登入。
          </p>
          <div className="field">
            <label htmlFor="code">6 碼驗證碼</label>
            <input
              id="code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              required
            />
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? "驗證中…" : "登入"}
            </button>
            <button type="button" className="btn-text" onClick={() => setStep("email")}>
              重新輸入 email
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
