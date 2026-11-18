export const SUPABASE_PROJECT_URL = "https://anklbpkyesdmsubyfcna.supabase.co";
export const EVENT_COVER_BUCKET = "gather-event-covers";
export const EVENT_COVER_PUBLIC_PREFIX =
  `${SUPABASE_PROJECT_URL}/storage/v1/object/public/${EVENT_COVER_BUCKET}`;

const UUID = "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
const EVENT_COVER_URL = new RegExp(
  `^${EVENT_COVER_PUBLIC_PREFIX.replaceAll(".", "\\.")}/${UUID}/${UUID}\\.(?:jpg|png|webp)$`,
);
const EVENT_COVER_PATH = new RegExp(`^${UUID}/${UUID}\\.(?:jpg|png|webp)$`);
const LEGACY_COVER_PATH = /^\/uploads\/(?!.*\.\.)[A-Za-z0-9._-]+$/;

export function isAllowedCoverImageUrl(value: string): boolean {
  return LEGACY_COVER_PATH.test(value) || EVENT_COVER_URL.test(value);
}

export function isAllowedEventCoverUrl(value: string): boolean {
  return EVENT_COVER_URL.test(value);
}

export function getEventCoverPath(value: string): string | null {
  if (!isAllowedEventCoverUrl(value)) return null;
  return value.slice(`${EVENT_COVER_PUBLIC_PREFIX}/`.length);
}

export function getEventCoverPublicUrl(path: string): string | null {
  if (!EVENT_COVER_PATH.test(path)) return null;
  return `${EVENT_COVER_PUBLIC_PREFIX}/${path}`;
}
