// slack-risk-formatter.js
// N8N Code node — Phase 1: PR Risk Analyzer
// Formats the AI risk classification into a Slack Block Kit message.
// Receives the AI response text + pr_metadata from the prompt-builder step.

// ── 1. Collect input ─────────────────────────────────────────────────────────
const input = $input.all()[0].json;
const meta = input.pr_metadata ?? input; // support either shape

// ── 2. Parse the AI response (tolerant of markdown fences) ───────────────────
let classification;
try {
  let raw =
    typeof input.ai_response === "string"
      ? input.ai_response
      : JSON.stringify(input.ai_response);

  // Strip markdown code fences if the model wrapped the JSON
  raw = raw
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  classification = JSON.parse(raw);
} catch (err) {
  console.error("Failed to parse AI response:", err.message);

  // Graceful fallback — surface a manual-review message
  return [
    {
      json: {
        slack_blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `⚠️ PR #${meta.pr_number}: Classification Failed`,
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Automatic classification failed — *manual review needed*.",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "View PR", emoji: true },
                url: meta.pr_url,
                style: "danger",
              },
            ],
          },
        ],
        slack_text: `⚠️ PR #${meta.pr_number} (${meta.pr_title}) — classification failed, manual review needed: ${meta.pr_url}`,
        risk_level: "unknown",
        ...meta,
      },
    },
  ];
}

// ── 3. Map risk level to emoji + color ───────────────────────────────────────
const riskMap = {
  low: { emoji: "🟢", color: "#36a64f" },
  medium: { emoji: "🟡", color: "#daa520" },
  high: { emoji: "🟠", color: "#ff8c00" },
  critical: { emoji: "🔴", color: "#dc3545" },
};

const level = classification.risk_level ?? "medium";
const { emoji, color } = riskMap[level] ?? riskMap.medium;

// ── 4. Build Slack Block Kit blocks ──────────────────────────────────────────
const blocks = [];

// Header
blocks.push({
  type: "header",
  text: {
    type: "plain_text",
    text: `${emoji} PR #${meta.pr_number}: ${meta.pr_title}`,
    emoji: true,
  },
});

// Risk summary
blocks.push({
  type: "section",
  text: {
    type: "mrkdwn",
    text: classification.summary,
  },
});

// Metadata fields
blocks.push({
  type: "section",
  fields: [
    { type: "mrkdwn", text: `*Author:*\n${meta.pr_author}` },
    { type: "mrkdwn", text: `*Risk Level:*\n${emoji} ${level.toUpperCase()}` },
    { type: "mrkdwn", text: `*Files Changed:*\n${meta.changed_files}` },
    {
      type: "mrkdwn",
      text: `*Lines:*\n+${meta.additions} / -${meta.deletions}`,
    },
  ],
});

// Key concerns (if any)
const concerns = classification.key_concerns ?? [];
if (concerns.length > 0) {
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `*Key Concerns:*\n${concerns.map((c) => `• ${c}`).join("\n")}`,
    },
  });
}

// Suggested reviewers (if any)
const reviewers = classification.suggested_reviewers ?? [];
if (reviewers.length > 0) {
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `👀 *Suggested expertise:* ${reviewers.join(", ")}`,
      },
    ],
  });
}

// Divider before action
blocks.push({ type: "divider" });

// Action button linking to the PR
blocks.push({
  type: "actions",
  elements: [
    {
      type: "button",
      text: { type: "plain_text", text: "View PR", emoji: true },
      url: meta.pr_url,
      style: level === "critical" || level === "high" ? "danger" : "primary",
    },
  ],
});

// ── 5. Plain-text fallback for notifications / simple clients ────────────────
const slack_text = `${emoji} PR #${meta.pr_number} (${meta.pr_title}) — Risk: ${level.toUpperCase()} — ${meta.pr_url}`;

// ── 6. Return everything downstream nodes need ──────────────────────────────
return [
  {
    json: {
      slack_blocks: blocks,
      slack_text,
      slack_color: color,
      risk_level: level,
      risk_summary: classification.summary,
      key_concerns: concerns,
      suggested_reviewers: reviewers,
      raw_ai_response: classification,
      // Pass through PR metadata for Supabase insert
      pr_number: meta.pr_number,
      pr_title: meta.pr_title,
      pr_author: meta.pr_author,
      pr_url: meta.pr_url,
      repo_full_name: meta.repo_full_name,
      additions: meta.additions,
      deletions: meta.deletions,
      changed_files: meta.changed_files,
    },
  },
];
