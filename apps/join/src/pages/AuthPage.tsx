import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ensureUserProfile, getEventBySlug } from "../lib/api";
import { clearPendingProfile, rememberPendingProfile } from "../lib/useSession";
import { normalizeInternalRedirect } from "../../shared/auth-redirect";

type Step = "email" | "code";
type AuthMethod = "password" | "email";

const LINE_ERROR_LABEL: Record<string, string> = {
  line_declined: "已取消 LINE 登入",
  missing_code_or_state: "LINE 登入回應不完整，請重新嘗試",
  state_mismatch: "登入驗證失敗，請重新嘗試",
  nonce_mismatch: "登入驗證失敗，請重新嘗試",
  audience_mismatch: "登入驗證失敗，請重新嘗試",
  token_exchange_failed: "LINE 登入暫時無法使用，請稍後再試",
  account_provisioning_failed: "LINE 登入暫時無法完成帳號建立，請稍後再試",
};

function getEventSlugFromRedirect(redirectTo: string): string | null {
  const match = redirectTo.match(/^\/e\/([^/?#]+)(?:[/?#]|$)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

export default function AuthPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = normalizeInternalRedirect(searchParams.get("redirect"));
  const lineError = searchParams.get("line_error");
  const eventSlug = getEventSlugFromRedirect(redirectTo);

  const [step, setStep] = useState<Step>("email");
  const [authMethod, setAuthMethod] = useState<AuthMethod>("password");
  const [eventTitle, setEventTitle] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasRedirectParam = searchParams.has("redirect");

  useEffect(() => {
    if (!hasRedirectParam) return;
    let active = true;
    const redirectIfSession = (nextSession: unknown) => {
      if (active && nextSession) navigate(redirectTo, { replace: true });
    };
    void supabase.auth.getSession().then(({ data }) => redirectIfSession(data.session));
    const { data: authState } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      redirectIfSession(nextSession);
    });
    return () => {
      active = false;
      authState.subscription.unsubscribe();
    };
  }, [hasRedirectParam, navigate, redirectTo]);

  useEffect(() => {
    let active = true;
    setEventTitle(null);
    if (!eventSlug) return () => { active = false; };

    getEventBySlug(eventSlug)
      .then((event) => {
        if (active) setEventTitle(event?.title ?? null);
      })
      .catch(() => {
        if (active) setEventTitle(null);
      });

    return () => {
      active = false;
    };
  }, [eventSlug]);

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
      rememberPendingProfile(email, displayName);
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          data: { display_name: displayName.trim() },
          // Without this, Supabase falls back to the project's dashboard
          // "Site URL" — which for this project is still the local-dev
          // default (localhost:3000), so the magic-link fallback inside
          // the OTP email 404s for real users. supabase-js auto-detects
          // the #access_token in this URL's hash on load (default
          // detectSessionInUrl: true), so this also makes clicking the
          // email link itself work as a login path, not just the 6-digit
          // code this page actually asks for.
          emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}auth?redirect=${encodeURIComponent(redirectTo)}`,
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

  async function handlePasswordLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("請輸入 email 與密碼");
      return;
    }
    setBusy(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      navigate(redirectTo, { replace: true });
    } catch {
      setError("Email 或密碼不正確。請確認使用的是帳號設定頁顯示的登入 email；若尚未綁定自己的 email，請先用原本的 LINE 登入。");
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
      if (verifyError) {
        setError(verifyError.message || "驗證碼錯誤或已過期");
        return;
      }

      // OTP verification has already created a valid session. Profile and
      // verified-email sync are best-effort follow-up work; they must not turn
      // a successful, consumed code into a misleading "expired" error.
      await ensureUserProfile(displayName.trim()).catch(() => undefined);
      clearPendingProfile(email);
      try {
        await supabase.rpc("sync_verified_email");
      } catch {
        // useSession will retry this safety-net sync after navigation.
      }
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
      <h1>開始報名</h1>
      {eventSlug && (
        <p className="auth-event-context">
          你正在報名：<strong>{eventTitle ?? "這場活動"}</strong>
        </p>
      )}
      <p className="auth-intro">
        可以用 LINE 登入、email 驗證碼，或已設定密碼的 email 登入。
      </p>
      <p className="hint auth-login-hint">
        第一次用 LINE 登入後，請到「設定登入密碼」查看目前登入 email；綁定並確認自己的 email 後，之後就能用它搭配密碼登入。
      </p>

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
          className="btn-primary auth-action"
        >
          使用 LINE 登入
        </button>
      </form>

      <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>或使用 email 登入：</p>

      {authMethod === "password" ? (
        <form className="stack card" onSubmit={handlePasswordLogin}>
          <div className="field">
            <label htmlFor="password-email">Email</label>
            <input
              id="password-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">密碼</label>
            <div className="password-field">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
          </div>
          <div className="actions">
            <button type="submit" className="btn-primary auth-action" disabled={busy}>
              {busy ? "登入中…" : "使用 email 與密碼登入"}
            </button>
            <button type="button" className="btn-text" onClick={() => {
              setAuthMethod("email");
              setError(null);
            }}>
              需要 email 驗證碼？用它登入或建立帳號
            </button>
          </div>
        </form>
      ) : step === "email" ? (
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
            <button type="submit" className="btn-primary auth-action" disabled={busy}>
              {busy ? "寄送中…" : "寄送驗證碼"}
            </button>
            <button type="button" className="btn-text" onClick={() => {
              setAuthMethod("password");
              setError(null);
            }}>
              已設定密碼？改用 email 與密碼登入
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
            <button type="button" className="btn-text" onClick={() => {
              setAuthMethod("password");
              setError(null);
            }}>
              已設定密碼？改用 email 與密碼登入
            </button>
          </div>
        </form>
      )}

      <p className="auth-privacy-note">
        我們只使用必要的登入與報名資料來處理報名、通知與取消，不會公開你的 email。
      </p>
      <p className="auth-consent">
        繼續即代表你同意
        <a href="/terms/" className="legal-link">服務條款</a>
        與
        <a href="/privacy/" className="legal-link">隱私權政策</a>。
      </p>
    </div>
  );
}
