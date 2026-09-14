-- UUID/password identity for loadstring.lua site accounts.
-- UUID is the public login identifier; internal user_id remains stable so rotation
-- never rewrites project ownership or analytics rows.
alter table creator_profiles
  add column if not exists login_uuid text,
  add column if not exists password_changed_at timestamptz,
  add column if not exists name_customized boolean not null default false;

create unique index if not exists creator_profiles_login_uuid_idx
  on creator_profiles (login_uuid)
  where login_uuid is not null;
