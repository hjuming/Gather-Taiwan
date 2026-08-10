-- Run only after P2-02 migration is applied to the intended Gather database.
-- This is a read-only check; it does not create fixtures or modify data.

select table_name, column_name, grantee, privilege_type
from information_schema.column_privileges
where table_schema = 'public'
  and table_name = 'users'
  and grantee = 'service_role'
  and column_name in ('id', 'line_user_id', 'email', 'email_normalized', 'display_name', 'email_verified_at')
order by column_name, privilege_type;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name = 'users'
  and grantee in ('public', 'anon', 'authenticated')
order by grantee, privilege_type;
