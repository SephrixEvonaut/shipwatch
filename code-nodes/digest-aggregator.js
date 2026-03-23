// digest-aggregator.js
// N8N Code node — Phase 3: Weekly Health Digest
// Receives items from three parallel data sources (GitHub PRs, GitHub Issues,
// Supabase PR analyses) and aggregates them into stats + an AI prompt for
// generating an executive digest.

// ── 1. Calculate the reporting window (last Mon → this Mon) ──────────────────
const now = new Date();
const dayOfWeek = now.getUTCDay(); // 0 = Sun
const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

const thisMonday = new Date(now);
thisMonday.setUTCDate(now.getUTCDate() - diffToMonday);
thisMonday.setUTCHours(0, 0, 0, 0);

const lastMonday = new Date(thisMonday);
lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);

const weekStart = lastMonday.toISOString().slice(0, 10); // "YYYY-MM-DD"
const weekEnd = thisMonday.toISOString().slice(0, 10);

// ── 2. Safely collect the three input arrays ─────────────────────────────────
// The items arrive from three parallel branches merged together.
// Each item has a __source field or we identify them by shape.
const allItems = $input.all().map((i) => i.json);

// Partition by source — the workflow tags each HTTP Request node output.
// If tags are missing, we try best-effort by looking at data shapes.
let prsRaw = [];
let issuesRaw = [];
let analysesRaw = [];

for (const item of allItems) {
  if (
    item._source === "prs" ||
    item.pull_request !== undefined ||
    item.merged_at !== undefined
  ) {
    prsRaw.push(item);
  } else if (
    item._source === "issues" ||
    (item.number !== undefined &&
      item.pull_request === undefined &&
      item.risk_level === undefined)
  ) {
    issuesRaw.push(item);
  } else if (item._source === "analyses" || item.risk_level !== undefined) {
    analysesRaw.push(item);
  }
}

// ── 3. Aggregate PR stats ────────────────────────────────────────────────────
let prStats = {
  total: 0,
  merged: 0,
  open: 0,
  avgHoursToMerge: null,
  available: true,
};

try {
  prStats.total = prsRaw.length;
  const merged = prsRaw.filter((p) => p.merged_at);
  prStats.merged = merged.length;
  prStats.open = prsRaw.filter((p) => p.state === "open").length;

  if (merged.length > 0) {
    const totalHours = merged.reduce((sum, p) => {
      const created = new Date(p.created_at);
      const mergedAt = new Date(p.merged_at);
      return sum + (mergedAt - created) / 3600000;
    }, 0);
    prStats.avgHoursToMerge = Math.round(totalHours / merged.length);
  }
} catch (_) {
  prStats = {
    total: 0,
    merged: 0,
    open: 0,
    avgHoursToMerge: null,
    available: false,
  };
}

// ── 4. Aggregate Issue stats ─────────────────────────────────────────────────
let issueStats = { totalOpened: 0, closed: 0, stillOpen: 0, available: true };

try {
  issueStats.totalOpened = issuesRaw.length;
  issueStats.closed = issuesRaw.filter((i) => i.state === "closed").length;
  issueStats.stillOpen = issuesRaw.filter((i) => i.state === "open").length;
} catch (_) {
  issueStats = { totalOpened: 0, closed: 0, stillOpen: 0, available: false };
}

// ── 5. Aggregate PR-analysis risk breakdown ──────────────────────────────────
let riskCounts = { low: 0, medium: 0, high: 0, critical: 0, available: true };

try {
  for (const a of analysesRaw) {
    const level = (a.risk_level || "").toLowerCase();
    if (level in riskCounts) riskCounts[level]++;
  }
} catch (_) {
  riskCounts = { low: 0, medium: 0, high: 0, critical: 0, available: false };
}

// ── 6. Aggregate issue-classification breakdown (if present) ─────────────────
let classificationCounts = {
  bug: 0,
  feature: 0,
  question: 0,
  documentation: 0,
  security: 0,
};
let priorityCounts = { P0: 0, P1: 0, P2: 0, P3: 0 };
let classificationsAvailable = false;

for (const a of analysesRaw) {
  if (a.classification) {
    classificationsAvailable = true;
    const cls = a.classification.toLowerCase();
    if (cls in classificationCounts) classificationCounts[cls]++;
  }
  if (a.priority) {
    const p = a.priority.toUpperCase();
    if (p in priorityCounts) priorityCounts[p]++;
  }
}

// ── 7. Build the raw_stats summary object ────────────────────────────────────
const raw_stats = {
  week_start: weekStart,
  week_end: weekEnd,
  prs: prStats,
  issues: issueStats,
  risk_breakdown: riskCounts,
  classification_breakdown: classificationsAvailable
    ? classificationCounts
    : null,
  priority_breakdown: classificationsAvailable ? priorityCounts : null,
};

// ── 8. Build the AI prompts ──────────────────────────────────────────────────
const system_prompt =
  "You are a senior engineering manager writing a concise weekly health digest " +
  "for your team. Be data-driven, specific, and actionable. " +
  "Respond ONLY with valid JSON, no markdown fences.";

const dataSections = [];

// PRs section
if (prStats.available && prStats.total > 0) {
  dataSections.push(`### Pull Requests
- Total PRs: ${prStats.total}
- Merged: ${prStats.merged}
- Still open: ${prStats.open}
- Avg hours to merge: ${prStats.avgHoursToMerge ?? "N/A"}`);
} else {
  dataSections.push(
    "### Pull Requests\n_No PR data available for this period._",
  );
}

// Issues section
if (issueStats.available && issueStats.totalOpened > 0) {
  dataSections.push(`### Issues
- Total opened: ${issueStats.totalOpened}
- Closed: ${issueStats.closed}
- Still open: ${issueStats.stillOpen}`);
} else {
  dataSections.push("### Issues\n_No issue data available for this period._");
}

// Risk breakdown
if (riskCounts.available) {
  dataSections.push(`### PR Risk Analysis
- Low risk: ${riskCounts.low}
- Medium risk: ${riskCounts.medium}
- High risk: ${riskCounts.high}
- Critical risk: ${riskCounts.critical}`);
} else {
  dataSections.push("### PR Risk Analysis\n_No analysis data available._");
}

// Classification breakdown (optional)
if (classificationsAvailable) {
  dataSections.push(`### Issue Classifications
- Bugs: ${classificationCounts.bug}
- Features: ${classificationCounts.feature}
- Questions: ${classificationCounts.question}
- Documentation: ${classificationCounts.documentation}
- Security: ${classificationCounts.security}

### Issue Priorities
- P0 (critical): ${priorityCounts.P0}
- P1 (high): ${priorityCounts.P1}
- P2 (medium): ${priorityCounts.P2}
- P3 (low): ${priorityCounts.P3}`);
}

const user_prompt = `## Weekly Repository Health Digest
**Period:** ${weekStart} to ${weekEnd}

${dataSections.join("\n\n")}

## Your Task

Write a weekly digest containing:
1. A **3-paragraph executive summary** covering: (a) overall velocity and health, (b) risk and quality observations, (c) team workload and trends.
2. **Top 3 highlights** — positive things worth celebrating.
3. **Top 3 concerns** — areas that need attention or are trending negatively.
4. A **recommended focus area** for next week (1-2 sentences).

Respond with **only** a JSON object (no markdown, no extra text) containing exactly these fields:

{
  "executive_summary": "Three paragraphs joined with \\n\\n",
  "highlights": ["highlight 1", "highlight 2", "highlight 3"],
  "concerns": ["concern 1", "concern 2", "concern 3"],
  "focus_area": "Recommended focus for next week"
}`;

// ── 9. Return ────────────────────────────────────────────────────────────────
return [
  {
    json: {
      system_prompt,
      user_prompt,
      week_start: weekStart,
      week_end: weekEnd,
      raw_stats,
    },
  },
];
