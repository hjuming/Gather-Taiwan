-- P2-04: 主辦人自訂公開代表圖
--
-- 公開 bucket 是刻意的產品決策：活動頁需要直接載入代表圖，持有圖片網址的人
-- 可以讀取；上傳與刪除仍只開給活動主辦團隊的 owner/admin。

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'gather-event-covers',
  'gather-event-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
);

create policy gather_event_covers_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'gather-event-covers'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and exists (
    select 1
    from public.events e
    where e.id::text = (storage.foldername(name))[1]
      and public.is_organizer_admin(e.organizer_id)
  )
);

-- supabase-js 的 upload 會在 INSERT 後讀回新物件 metadata；這個 SELECT
-- policy 只開放同一活動的主辦管理者，不開放匿名列舉 bucket。
create policy gather_event_covers_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'gather-event-covers'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and exists (
    select 1
    from public.events e
    where e.id::text = (storage.foldername(name))[1]
      and public.is_organizer_admin(e.organizer_id)
  )
);

create policy gather_event_covers_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'gather-event-covers'
  and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
  and exists (
    select 1
    from public.events e
    where e.id::text = (storage.foldername(name))[1]
      and public.is_organizer_admin(e.organizer_id)
  )
);

alter table public.events
  drop constraint event_cover_image_url_internal;
alter table public.events
  add constraint event_cover_image_url_internal
  check (
    cover_image_url is null
    or (
      cover_image_url ~ '^/uploads/[A-Za-z0-9._-]+$'
      and cover_image_url !~ '\.\.'
    )
    or cover_image_url ~ '^https://anklbpkyesdmsubyfcna\.supabase\.co/storage/v1/object/public/gather-event-covers/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(jpg|png|webp)$'
  );
