import postgres from "postgres";

const databaseUrl = process.env.GATHER_JOIN_TEST_DATABASE_URL;
if (!databaseUrl) throw new Error("GATHER_JOIN_TEST_DATABASE_URL is required for probe verification.");

const sql = postgres(databaseUrl, { max: 1 });

try {
  const migrationRows = await sql`
    select version
    from supabase_migrations.schema_migrations
    where version = '20260802010000'
  `;
  const probeRows = await sql`
    select probe_key, counter, version
    from public.p1_framework_probe
    order by probe_key
  `;
  const securityRows = await sql`
    select
      relation.relrowsecurity as rls_enabled
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname = 'p1_framework_probe'
  `;
  const apiPrivilegeRows = await sql`
    with role_names(role_name) as (
      values ('anon'::text), ('authenticated'::text)
    ), privilege_names(privilege_name) as (
      values
        ('SELECT'::text),
        ('INSERT'::text),
        ('UPDATE'::text),
        ('DELETE'::text),
        ('TRUNCATE'::text),
        ('REFERENCES'::text),
        ('TRIGGER'::text)
    )
    select
      role_name,
      privilege_name,
      has_table_privilege(
        role_name,
        'public.p1_framework_probe',
        privilege_name
      ) as allowed
    from role_names
    cross join privilege_names
    order by role_name, privilege_name
  `;
  const publicPrivilegeRows = await sql`
    select expanded_acl.privilege_type
    from pg_class as relation
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    cross join lateral aclexplode(
      coalesce(relation.relacl, acldefault('r', relation.relowner))
    ) as expanded_acl
    where namespace.nspname = 'public'
      and relation.relname = 'p1_framework_probe'
      and expanded_acl.grantee = 0
  `;

  if (migrationRows.length !== 1) throw new Error("P1 framework probe migration is absent from the ledger.");
  if (probeRows.length !== 1) throw new Error("P1 framework probe seed must contain exactly one row.");

  const probe = probeRows[0];
  const probeVersion =
    typeof probe.version === "bigint" ? probe.version : BigInt(probe.version);
  if (probe.probe_key !== "p1-01" || probe.counter !== 0 || probeVersion !== 0n) {
    throw new Error("P1 framework probe seed does not match the deterministic zero state.");
  }

  const security = securityRows[0];
  if (
    securityRows.length !== 1 ||
    security.rls_enabled !== true ||
    apiPrivilegeRows.length !== 14 ||
    apiPrivilegeRows.some((privilege) => privilege.allowed !== false) ||
    publicPrivilegeRows.length !== 0
  ) {
    throw new Error("P1 framework probe is not default-deny for API roles.");
  }

  process.stdout.write("Migration ledger, PII-free seed, and default-deny privileges verified.\n");
} finally {
  await sql.end({ timeout: 1 });
}
