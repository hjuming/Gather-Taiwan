import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "supabase/migrations/20260802152000_p1_02_canonical_schema.sql",
);
const ownerTransferFixPath = resolve(
  process.cwd(),
  "supabase/migrations/20260802154000_p1_02_owner_transfer_fix.sql",
);
const registrationGuardrailsPath = resolve(
  process.cwd(),
  "supabase/migrations/20260802160000_p1_02_registration_guardrails.sql",
);

const domainTables = [
  "users",
  "organizers",
  "organizer_members",
  "events",
  "event_fields",
  "registrations",
  "registration_answers",
  "event_invitees",
  "event_blocklist",
  "idempotency_requests",
  "notifications",
  "outbox_events",
  "audit_logs",
] as const;

describe("P1-02 canonical registration schema contract", () => {
  it("defines the canonical domain without participant payment-proof storage", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

    for (const table of domainTables) {
      expect(sql).toContain(`create table public.${table}`);
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`alter table public.${table} force row level security`);
      expect(sql).toMatch(
        new RegExp(
          `revoke\\s+all\\s+on\\s+table\\s+public\\.${table}\\s+from\\s+public\\s*,\\s*anon\\s*,\\s*authenticated`,
        ),
      );
    }

    expect(sql).toContain("line_user_id text unique");
    expect(sql).toContain("payment_declared_at timestamptz");
    expect(sql).toContain("public.is_prohibited_payment_proof_field_name");
    expect(sql).not.toMatch(/create\s+table\s+public\.(orders|payments|refunds|merchant_connections)\b/);
    expect(sql).not.toMatch(/\b(payment_status|paid_at|transaction_id|transfer_last_digits|payment_screenshot)\b/);
    expect(sql).not.toMatch(/\bchecked_in_(at|by|seats)\b/);
  });

  it("encodes status, ownership, idempotency, capacity, and active-registration invariants", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

    expect(sql).toContain("create type public.event_status");
    expect(sql).toContain("create type public.registration_status");
    expect(sql).toContain("create type public.seat_pool");
    expect(sql).toContain("create type public.organizer_role");
    expect(sql).toContain("pending_organizer_confirmation");
    expect(sql).toContain("removed_by_organizer");
    expect(sql).toContain("invite_pool_released_at timestamptz");
    expect(sql).toContain("capacity is null");
    expect(sql).toContain("invite_reserved_seats is null");
    expect(sql).toMatch(
      /create\s+unique\s+index\s+one_active_owner_per_organizer[\s\S]+where[\s\S]+role\s*=\s*'owner'/,
    );
    expect(sql).toMatch(
      /create\s+unique\s+index\s+one_active_registration_per_user_event[\s\S]+where[\s\S]+status\s+in[\s\S]+offered[\s\S]+pending_organizer_confirmation[\s\S]+confirmed[\s\S]+waitlisted/,
    );
    expect(sql).toContain("unique (actor_user_id, operation, key_hash)");
    expect(sql).toContain(
      "unique (registration_id, transition_version, notification_kind)",
    );
    expect(sql).toContain("create constraint trigger organizer_must_have_one_owner");
    expect(sql).toContain("create function public.transfer_organizer_ownership");
    expect(sql).toContain("set search_path = pg_catalog, public");
  });

  it("stores absolute instants with an IANA timezone and makes registration/start rules explicit", async () => {
    const sql = (await readFile(migrationPath, "utf8")).toLowerCase();

    expect(sql).toContain("timezone text not null");
    expect(sql).toContain("starts_at timestamptz not null");
    expect(sql).toContain("ends_at timestamptz not null");
    expect(sql).toContain("registration_opens_at timestamptz");
    expect(sql).toContain("registration_closes_at timestamptz");
    expect(sql).toContain("create function public.event_registration_is_open");
    expect(sql).toContain("create function public.guard_event_safety_edits_after_start");
    expect(sql).toContain("create function public.validate_event_timezone");
  });

  it("keeps owner transfer atomic even when the caller has made constraints immediate", async () => {
    const sql = (await readFile(ownerTransferFixPath, "utf8")).toLowerCase();

    expect(sql).toContain("create or replace function public.transfer_organizer_ownership");
    expect(sql).toContain(
      "set constraints organizer_members_must_preserve_one_owner deferred",
    );
    expect(sql).toContain(
      "set constraints organizer_members_must_preserve_one_owner immediate",
    );
    expect(sql).toContain("set search_path = pg_catalog, public");
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.transfer_organizer_ownership\(uuid,\s*uuid\)[\s\S]+from\s+public\s*,\s*anon\s*,\s*authenticated/,
    );
  });

  it("enforces the registration window, initial state, and legal status transitions in the database", async () => {
    const sql = (await readFile(registrationGuardrailsPath, "utf8")).toLowerCase();

    expect(sql).toContain(
      "create function public.is_registration_status_transition_allowed",
    );
    expect(sql).toContain("create function public.guard_registration_state_machine");
    expect(sql).toContain("create trigger guard_registration_state_machine_before_write");
    expect(sql).toContain("create function public.guard_organizer_membership_identity");
    expect(sql).toContain("create trigger guard_organizer_membership_identity_before_update");
    expect(sql).toContain("public.event_registration_is_open(new.event_id");
    expect(sql).toContain("terminal registration status cannot transition");
    expect(sql).toContain("unique (id, event_id)");
    expect(sql).toContain("foreign key (registration_id, event_id)");
    expect(sql).toContain("foreign key (event_field_id, event_id)");
    expect(sql).toContain("foreign key (result_registration_id, event_id)");
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.is_registration_status_transition_allowed[\s\S]+from\s+public\s*,\s*anon\s*,\s*authenticated/,
    );
    expect(sql).toMatch(
      /revoke\s+all\s+on\s+function\s+public\.guard_registration_state_machine[\s\S]+from\s+public\s*,\s*anon\s*,\s*authenticated/,
    );
  });
});
