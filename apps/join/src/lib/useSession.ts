import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { ensureUserProfile } from "./api";

const PENDING_PROFILE_KEY = "gather.pending_profile_name";

type PendingProfile = {
  email: string;
  displayName: string;
};

function readPendingProfile(email: string | undefined): string | null {
  if (typeof window === "undefined" || !email) return null;
  try {
    const raw = window.localStorage.getItem(PENDING_PROFILE_KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as Partial<PendingProfile>;
    if (pending.email?.trim().toLowerCase() !== email.trim().toLowerCase()) return null;
    return pending.displayName?.trim() || null;
  } catch {
    return null;
  }
}

export function rememberPendingProfile(email: string, displayName: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      PENDING_PROFILE_KEY,
      JSON.stringify({ email: email.trim(), displayName: displayName.trim() }),
    );
  } catch {
    // Storage can be unavailable in privacy-restricted browsers; use the email fallback.
  }
}

export function clearPendingProfile(email: string | undefined): void {
  if (typeof window === "undefined" || !email) return;
  const pending = readPendingProfile(email);
  if (!pending) return;
  try {
    window.localStorage.removeItem(PENDING_PROFILE_KEY);
  } catch {
    // Ignore storage cleanup failures after the profile is already synced.
  }
}

function profileNameForSession(session: Session): string {
  const metadataName = session.user.user_metadata?.display_name;
  if (typeof metadataName === "string" && metadataName.trim()) return metadataName.trim();
  return readPendingProfile(session.user.email) ?? session.user.email?.split("@")[0] ?? "聚場會員";
}

const profileBootstrap = new Map<string, Promise<void>>();

function ensureSessionProfile(session: Session | null): Promise<void> {
  if (!session) return Promise.resolve();
  const userId = session.user.id;
  const existing = profileBootstrap.get(userId);
  if (existing) return existing;
  const pending = ensureUserProfile(profileNameForSession(session))
    .then(() => clearPendingProfile(session.user.email))
    .finally(() => profileBootstrap.delete(userId));
  profileBootstrap.set(userId, pending);
  return pending;
}

export function useSession(): { session: Session | null; loading: boolean } {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      await ensureSessionProfile(data.session).catch(() => undefined);
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      void ensureSessionProfile(nextSession).catch(() => undefined);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return { session, loading };
}
