-- Site-owned profiles, guest sessions, execution logs, obfuscation, webhook kinds.

alter table creator_profiles
  add column if not exists display_name text not null default '',
  add column if not exists handle text,
  add column if not exists bio text not null default '',
  add column if not exists email text,
  add column if not exists email_registered boolean not null default false,
  add column if not exists is_guest boolean not null default true,
  add column if not exists avatar_hue integer not null default 210,
  add column if not exists password_hash text,
  add column if not exists auth_user_id text;

create unique index if not exists creator_profiles_handle_idx
  on creator_profiles (handle);
create unique index if not exists creator_profiles_email_idx
  on creator_profiles (email);
create index if not exists creator_profiles_auth_user_id_idx
  on creator_profiles (auth_user_id);

alter table projects
  add column if not exists obfuscate boolean not null default false;

alter table webhooks
  add column if not exists kind text not null default 'generic',
  add column if not exists payload_mode text not null default 'full',
  add column if not exists discord_username text,
  add column if not exists content_template text;

create table if not exists execution_logs (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  version_id text,
  kind text not null,
  message text,
  status_code integer not null default 200,
  region text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists execution_logs_project_created_idx
  on execution_logs (project_id, created_at desc);
create index if not exists execution_logs_project_kind_idx
  on execution_logs (project_id, kind);

create table if not exists site_tokens (
  id text primary key,
  token_hash text not null unique,
  user_id text not null,
  kind text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists site_tokens_user_idx on site_tokens (user_id);
