-- P2-07: a newly created event must always start in the future.
-- Existing completed events remain valid; this trigger is INSERT-only.

create function public.prevent_past_event_creation()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.starts_at <= statement_timestamp() then
    raise exception 'new events must start in the future' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger events_prevent_past_creation
before insert on public.events
for each row execute function public.prevent_past_event_creation();

revoke all on function public.prevent_past_event_creation() from public, anon, authenticated;
