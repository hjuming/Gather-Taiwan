import { EVENT_COVER_BUCKET, getEventCoverPath, isAllowedEventCoverUrl } from "../../shared/event-cover-policy";
import { supabase } from "./supabase";
import { getEventCoverExtension, validateEventCoverFile } from "./event-cover-validation";

export { EVENT_COVER_BUCKET, isAllowedEventCoverUrl };
export { EVENT_COVER_MAX_BYTES, EVENT_COVER_MAX_DIMENSION, validateEventCoverFile } from "./event-cover-validation";

export async function uploadEventCover(eventId: string, file: File): Promise<string> {
  const validationError = await validateEventCoverFile(file);
  if (validationError) throw new Error(validationError);

  const mimeType = file.type;
  const extension = getEventCoverExtension(mimeType);
  if (!extension) throw new Error("代表圖請使用 JPG、PNG 或 WebP。");
  const path = `${eventId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(EVENT_COVER_BUCKET).upload(path, file, {
    cacheControl: "31536000",
    contentType: mimeType,
    upsert: false,
  });
  if (error) throw new Error(`代表圖上傳失敗：${error.message}`);

  const { data } = supabase.storage.from(EVENT_COVER_BUCKET).getPublicUrl(path);
  if (!isAllowedEventCoverUrl(data.publicUrl)) throw new Error("代表圖網址格式不安全，未儲存這張圖片。");
  return data.publicUrl;
}

export async function removeEventCover(publicUrl: string): Promise<void> {
  const path = getEventCoverPath(publicUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(EVENT_COVER_BUCKET).remove([path]);
  if (error) throw new Error(`舊代表圖清理失敗：${error.message}`);
}
