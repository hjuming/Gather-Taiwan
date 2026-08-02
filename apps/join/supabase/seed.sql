-- PII-free, idempotent seed for isolated local or remote P1-01 probe verification.
insert into public.p1_framework_probe (probe_key, counter, version)
values ('p1-01', 0, 0)
on conflict (probe_key) do nothing;
