-- Canonical seat-engine hardening B.
--
-- A-stage switched the organizer editor to the single, locked
-- update_event_capacity_settings RPC. This forward-only migration removes
-- the remaining authenticated direct UPDATE capability for capacity and
-- invite-pool state. Read access remains unchanged; the organizer RPC is the
-- only application-role write path for these columns.

revoke update (
  capacity,
  invite_reserved_seats,
  invite_pool_deadline,
  invite_pool_released_at
) on public.events from public, anon, authenticated;

-- Keep the sensitive-column write contract explicit: only the SECURITY
-- DEFINER RPC granted by A may change these values for an application user.
revoke all on function public.update_event_capacity_settings(
  uuid,
  text,
  integer,
  integer,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.update_event_capacity_settings(
  uuid,
  text,
  integer,
  integer,
  timestamptz
) to authenticated;
