// stale-pr-filter.js
// N8N Code node — Phase 4: Stale PR Escalation
// Receives open PRs from the GitHub API and filters/categorizes stale ones.

const WARNING_HOURS = 48; // 2 days
const CRITICAL_HOURS = 120; // 5 days

// ── 1. Current timestamp ─────────────────────────────────────────────────────
const now = Date.now();

// ── 2. Process each PR ───────────────────────────────────────────────────────
const warnings = [];
const critical = [];

for (const item of $input.all()) {
  const pr = item.json;

  const updatedAt = new Date(pr.updated_at);
  const hoursSinceUpdate = (now - updatedAt.getTime()) / 3600000;

  if (hoursSinceUpdate < WARNING_HOURS) continue; // still fresh

  const days = Math.floor(hoursSinceUpdate / 24);
  const remainingHours = Math.floor(hoursSinceUpdate % 24);
  const reviewers = (pr.requested_reviewers ?? []).map((r) => r.login);

  const entry = {
    number: pr.number,
    title: pr.title,
    author: pr.user?.login ?? "unknown",
    url: pr.html_url,
    hours_stale: Math.round(hoursSinceUpdate),
    days_stale: days,
    category: hoursSinceUpdate >= CRITICAL_HOURS ? "critical" : "warning",
    requested_reviewers: reviewers,
    last_updated: pr.updated_at,
    slack_line:
      `• <${pr.html_url}|PR #${pr.number}: ${pr.title}>` +
      ` — by ${pr.user?.login ?? "unknown"}, stale ${days}d ${remainingHours}h` +
      ` — reviewers: ${reviewers.length > 0 ? reviewers.join(", ") : "none assigned"}`,
  };

  if (entry.category === "critical") {
    critical.push(entry);
  } else {
    warnings.push(entry);
  }
}

// ── 3. Sort most stale first ─────────────────────────────────────────────────
critical.sort((a, b) => b.hours_stale - a.hours_stale);
warnings.sort((a, b) => b.hours_stale - a.hours_stale);

// ── 4. Return ────────────────────────────────────────────────────────────────
return [
  {
    json: {
      warnings,
      critical,
      total_stale: warnings.length + critical.length,
      total_warnings: warnings.length,
      total_critical: critical.length,
    },
  },
];
