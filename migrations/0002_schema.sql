-- loadstring.lua application schema
-- Private Luau source lives only in script_versions.source_code.
-- Published /raw payloads are wrapped at serve time; wrap_seed never leaves /x.
-- Every owner-scoped table uses TEXT user ids (Better Auth / preview 'dev-user').

create table if not exists projects (
  id text primary key,
  owner_id text not null,
  name text not null,
  slug text not null unique,
  description text not null default '',
  status text not null default 'draft',
  current_version_id text,
  published_version_id text,
  runtime_id text not null unique,
  wrap_seed text not null,
  execution_count integer not null default 0,
  fetch_count integer not null default 0,
  error_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_owner_id_idx on projects (owner_id);
create index if not exists projects_slug_idx on projects (slug);
create index if not exists projects_status_idx on projects (status);
create index if not exists projects_runtime_id_idx on projects (runtime_id);

create table if not exists script_versions (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  version text not null,
  source_code text not null,
  changelog text not null default '',
  is_published boolean not null default false,
  archived boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, version)
);

create index if not exists script_versions_project_id_idx on script_versions (project_id);
create index if not exists script_versions_published_idx on script_versions (project_id, is_published);

create table if not exists analytics_events (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  version_id text,
  event_type text not null,
  status_code integer not null default 200,
  user_agent text,
  region text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_project_created_idx
  on analytics_events (project_id, created_at desc);
create index if not exists analytics_events_project_type_idx
  on analytics_events (project_id, event_type);

create table if not exists webhooks (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  name text not null,
  endpoint text not null,
  encrypted_secret text not null,
  secret_suffix text not null default '',
  events text not null default 'published,updated,execution,error,version_published',
  enabled boolean not null default true,
  last_status integer,
  last_fired_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists webhooks_project_id_idx on webhooks (project_id);

create table if not exists audit_logs (
  id text primary key,
  user_id text not null,
  project_id text,
  action text not null,
  metadata text not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_user_idx on audit_logs (user_id, created_at desc);
create index if not exists audit_logs_project_idx on audit_logs (project_id, created_at desc);

create table if not exists creator_profiles (
  user_id text primary key,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
