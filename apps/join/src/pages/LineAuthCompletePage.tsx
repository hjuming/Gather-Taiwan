import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { ensureUserProfile } from "../lib/api";

export default function LineAuthCompletePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const tokenHash = searchParams.get("token_hash");
    const redirectTo = searchParams.get("redirect") || "/";

    if (!tokenHash) {
      setError("登入連結不完整，請重新登入");
      return;
    }

    (async () => {
      const { data, error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (verifyError || !data.session) {
        setError(verifyError?.message ?? "登入驗證失敗");
        return;
      }

      const lineName =
        (data.user?.user_metadata?.name as string | undefined) ?? data.user?.email ?? "LINE 使用者";
      try {
        await ensureUserProfile(lineName);
        await supabase.rpc("sync_verified_email");
      } catch {
        // best-effort safety net; LINE callback already provisioned the profile
      }

      navigate(redirectTo, { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="page">
      <p className="eyebrow">來聚一場</p>
      <h1>登入中…</h1>
      {error ? (
        <div className="banner banner--error">
          {error}
          <div style={{ marginTop: 12 }}>
            <a href="/app/auth">回登入頁</a>
          </div>
        </div>
      ) : (
        <p style={{ color: "var(--muted)" }}>正在完成 LINE 登入，請稍候…</p>
      )}
    </div>
  );
}
