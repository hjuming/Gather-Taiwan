-- Keep invitation targets protected even for the table owner in exposed public schema.
alter table public.event_invitation_targets force row level security;
