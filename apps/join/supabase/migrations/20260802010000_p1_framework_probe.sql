-- P1-01-B framework probe only. This migration must not introduce events,
-- registrations, domain enums, RLS policies, domain RPCs, or domain triggers.

create table public.p1_framework_probe (
  probe_key text primary key check (probe_key = 'p1-01'),
  counter integer not null default 0 check (counter >= 0),
  version bigint not null default 0 check (version >= 0)
);

alter table public.p1_framework_probe enable row level security;
revoke all on table public.p1_framework_probe from public, anon, authenticated;
