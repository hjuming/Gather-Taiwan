-- P2-03: 聚會類型與代表圖
--
-- 目的：
--   1. 讓主辦人在建立聚會時選一個「類型」，類型決定活動頁 hero 與分享 OG 的預設代表圖。
--   2. 讓主辦人可以自行更換代表圖（目前限站內 /uploads/ 的策展圖庫）。
--
-- 安全邊界：
--   cover_image_url 只允許站內相對路徑，於資料庫層以 check 約束擋掉任意外部網址，
--   避免有人把外部或 javascript: 位址寫進來後被前端當成圖片來源載入。

alter table public.events
  add column if not exists gathering_type text not null default 'other',
  add column if not exists cover_image_url text;

-- 類型值由應用層維護（src/lib/gathering-types.ts），資料庫只擋明顯不合法的輸入。
alter table public.events
  drop constraint if exists event_gathering_type_format;
alter table public.events
  add constraint event_gathering_type_format
  check (gathering_type ~ '^[a-z][a-z0-9_]{1,39}$');

alter table public.events
  drop constraint if exists event_cover_image_url_internal;
alter table public.events
  add constraint event_cover_image_url_internal
  check (
    cover_image_url is null
    or (
      cover_image_url ~ '^/uploads/[A-Za-z0-9._-]+$'
      and cover_image_url !~ '\.\.'
    )
  );

-- 既有活動維持 'other' 預設值，沿用原本的全站預設圖，行為不變。

grant select (gathering_type, cover_image_url) on public.events to anon, authenticated;
grant insert (gathering_type, cover_image_url) on public.events to authenticated;
grant update (gathering_type, cover_image_url) on public.events to authenticated;
