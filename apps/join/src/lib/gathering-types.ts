// 聚會類型：沿用主站「聚場地圖」既有的相聚語彙，讓報名系統與主站講同一套話。
// 每個類型帶一張預設代表圖（同時用於活動頁 hero 與分享時的 OG 圖），
// 主辦人可以再自行改選其他張。圖片由主站 Pages 於 /uploads/ 提供，同網域同源。

export interface GatheringType {
  key: string;
  label: string;
  hint: string;
  image: string;
}

const DEFAULT_IMAGE = "/uploads/gather-home-hero-documentary-v1.jpg";

export const GATHERING_TYPES: readonly GatheringType[] = [
  {
    key: "market_breakfast",
    label: "市場早餐",
    hint: "城市醒來的地方，早餐、熟食與攤商的招呼聲",
    image: "/uploads/gather-market-morning-documentary-v1.jpg",
  },
  {
    key: "harbor_dinner",
    label: "港邊晚餐",
    hint: "海風與魚市的晚餐，冰塊、魚籃與海鮮桌",
    image: "/uploads/gather-harbor-dinner-documentary-v1.jpg",
  },
  {
    key: "rechao",
    label: "熱炒聚會",
    hint: "鑊氣、碰杯聲與一桌熱菜",
    image: "/uploads/gather-neo-rechao-cheers-v1.jpg",
  },
  {
    key: "moonlight_grill",
    label: "月光開烤",
    hint: "中秋的炭香，月光下的長桌",
    image: "/uploads/gather-moonlight-charcoal-v1.jpg",
  },
  {
    key: "riverside_picnic",
    label: "城市野餐",
    hint: "河濱與草地，適合白天的鬆散相聚",
    image: "/uploads/gather-bg-riverside-table-v1.jpg",
  },
  {
    key: "local_banquet",
    label: "地方辦桌",
    hint: "巷口的圓桌，一次坐下一整條街",
    image: "/uploads/gather-local-banquet-v1.jpg",
  },
  {
    key: "winter_hotpot",
    label: "冬季鍋物",
    hint: "熱氣、湯鍋與擠在一起的冬夜",
    image: "/uploads/gather-winter-table-v1.jpg",
  },
  {
    key: "temple_festival",
    label: "廟會相聚",
    hint: "廟埕、陣頭與地方節慶的日子",
    image: "/uploads/gather-bg-local-festival-supply-v1.jpg",
  },
  {
    key: "tea_table",
    label: "茶席",
    hint: "一壺茶的時間，安靜而慢的相聚",
    image: "/uploads/gather-tea-table-v1.jpg",
  },
  {
    key: "other",
    label: "其他",
    hint: "讀書會、同學會、慶生、工作坊…任何想聚的理由",
    image: DEFAULT_IMAGE,
  },
] as const;

export const DEFAULT_GATHERING_TYPE = "other";

/** 所有可選的代表圖（供主辦人自行更換）。 */
export const COVER_IMAGE_CHOICES: readonly { url: string; label: string }[] =
  GATHERING_TYPES.map((type) => ({ url: type.image, label: type.label }));

export function getGatheringType(key: string | null | undefined): GatheringType {
  return (
    GATHERING_TYPES.find((type) => type.key === key) ??
    GATHERING_TYPES.find((type) => type.key === DEFAULT_GATHERING_TYPE)!
  );
}

export function getGatheringTypeLabel(key: string | null | undefined): string | null {
  if (!key) return null;
  return GATHERING_TYPES.find((type) => type.key === key)?.label ?? null;
}

/**
 * 活動的代表圖：主辦人自選的優先，其次是類型預設圖，最後才是全站預設。
 * 只接受站內 /uploads/ 路徑，避免有人把任意外部網址寫進資料庫後被當成圖片載入。
 */
export function resolveCoverImage(event: {
  cover_image_url?: string | null;
  gathering_type?: string | null;
}): string {
  const custom = event.cover_image_url?.trim();
  if (custom && custom.startsWith("/uploads/") && !custom.includes("..")) {
    return custom;
  }
  return getGatheringType(event.gathering_type).image;
}
