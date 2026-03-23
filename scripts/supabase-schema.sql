-- ShipWatch — Supabase Schema
-- Run this file in the Supabase SQL Editor (https://app.supabase.com → your project → SQL Editor).
-- It creates all tables, enables row-level security, and adds performance indexes.

-- ============================================================
-- 1. pr_analyses
-- ============================================================
create table if not exists pr_analyses (
  id               uuid        primary key default gen_random_uuid(),
  github_pr_number integer     not null,
  github_repo      text        not null,
  pr_title         text        not null,
  pr_author        text        not null,
  risk_level       text        not null check (risk_level in ('low', 'medium', 'high', 'critical')),
  risk_summary     text        not null,
  files_changed    integer,
  lines_added      integer,
  lines_removed    integer,
  ai_model_used    text,
  analyzed_at      timestamptz default now(),
  raw_ai_response  jsonb
);

-- ============================================================
-- 2. issue_classifications
-- ============================================================
create table if not exists issue_classifications (
  id                  uuid        primary key default gen_random_uuid(),
  github_issue_number integer     not null,
  github_repo         text        not null,
  issue_title         text        not null,
  issue_author        text        not null,
  classification      text        not null check (classification in ('bug', 'feature', 'question', 'documentation', 'security')),
  priority            text        not null check (priority in ('P0', 'P1', 'P2', 'P3')),
  routed_to           text        not null,
  labels_applied      text[],
  classified_at       timestamptz default now(),
  raw_ai_response     jsonb
);

-- ============================================================
-- 3. weekly_digests
-- ============================================================
create table if not exists weekly_digests (
  id               uuid        primary key default gen_random_uuid(),
  week_start       date        not null,
  week_end         date        not null,
  total_prs        integer,
  total_issues     integer,
  total_commits    integer,
  high_risk_prs    integer,
  p0_p1_bugs       integer,
  digest_markdown  text        not null,
  generated_at     timestamptz default now()
);

-- ============================================================
-- 4. escalations
-- ============================================================
create table if not exists escalations (
  id               uuid        primary key default gen_random_uuid(),
  escalation_type  text        not null check (escalation_type in ('stale_pr', 'p0_bug', 'unreviewed')),
  github_url       text        not null,
  github_repo      text        not null,
  author           text,
  days_stale       integer,
  escalated_to     text        not null,
  resolved         boolean     default false,
  escalated_at     timestamptz default now(),
  resolved_at      timestamptz
);

-- ============================================================
-- Row-Level Security
-- ============================================================
alter table pr_analyses          enable row level security;
alter table issue_classifications enable row level security;
alter table weekly_digests       enable row level security;
alter table escalations          enable row level security;

create policy "Authenticated users full access on pr_analyses"
  on pr_analyses for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users full access on issue_classifications"
  on issue_classifications for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users full access on weekly_digests"
  on weekly_digests for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "Authenticated users full access on escalations"
  on escalations for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- ============================================================
-- Indexes
-- ============================================================
create index if not exists idx_pr_analyses_repo        on pr_analyses (github_repo);
create index if not exists idx_pr_analyses_analyzed_at  on pr_analyses (analyzed_at);

create index if not exists idx_issue_classifications_repo          on issue_classifications (github_repo);
create index if not exists idx_issue_classifications_classified_at on issue_classifications (classified_at);

create index if not exists idx_weekly_digests_week_start on weekly_digests (week_start);

create index if not exists idx_escalations_repo         on escalations (github_repo);
create index if not exists idx_escalations_escalated_at on escalations (escalated_at);
