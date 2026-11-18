export const EVENT_COVER_MAX_BYTES = 5 * 1024 * 1024;
export const EVENT_COVER_MAX_DIMENSION = 4096;

const MIME_TO_EXTENSION = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type EventCoverMimeType = keyof typeof MIME_TO_EXTENSION;

function isSupportedMimeType(value: string): value is EventCoverMimeType {
  return Object.prototype.hasOwnProperty.call(MIME_TO_EXTENSION, value);
}

function hasExpectedMagicBytes(mimeType: EventCoverMimeType, bytes: Uint8Array): boolean {
  if (mimeType === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mimeType === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  }
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

async function getImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  }

  if (typeof Image === "undefined" || typeof URL.createObjectURL !== "function") return null;

  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<{ width: number; height: number } | null>((resolve) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => resolve(null);
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function validateEventCoverFile(file: File): Promise<string | null> {
  const mimeType = file.type as EventCoverMimeType;
  if (!isSupportedMimeType(mimeType)) return "代表圖請使用 JPG、PNG 或 WebP。";
  if (file.size === 0) return "代表圖檔案是空的，請重新選擇。";
  if (file.size > EVENT_COVER_MAX_BYTES) return "代表圖請小於 5 MB。";

  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!hasExpectedMagicBytes(mimeType, bytes)) return "代表圖檔案格式與內容不一致，請重新輸出圖片後再上傳。";

  try {
    const dimensions = await getImageDimensions(file);
    if (dimensions && (dimensions.width > EVENT_COVER_MAX_DIMENSION || dimensions.height > EVENT_COVER_MAX_DIMENSION)) {
      return `代表圖的寬高請小於 ${EVENT_COVER_MAX_DIMENSION}px。`;
    }
  } catch {
    return "代表圖無法讀取，請改用 JPG、PNG 或 WebP 圖片。";
  }

  return null;
}

export function getEventCoverExtension(mimeType: string): string | null {
  return isSupportedMimeType(mimeType)
    ? MIME_TO_EXTENSION[mimeType as EventCoverMimeType]
    : null;
}
