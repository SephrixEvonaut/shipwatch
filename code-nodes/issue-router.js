// issue-router.js
// N8N Code node — Phase 2: Issue Triage & Routing
// Parses the AI classification response, determines routing, and builds
// a Slack Block Kit message tailored to the target channel.

// ── 1. Collect input ─────────────────────────────────────────────────────────
const input = $input.all()[0].json;
const meta = input.issue_metadata;

// Extract AI text from Anthropic response format
let aiText = "";
try {
  aiText = input.content[0].text;
} catch (_) {
  // fallback: the AI response may already be a flat string
  aiText =
    typeof input.ai_response === "string"
      ? input.ai_response
      : JSON.stringify(input.ai_response ?? "");
}

// ── 2. Parse the AI response (tolerant of markdown fences) ───────────────────
let classification;
try {
  let raw = aiText;
  raw = raw
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();
  classification = JSON.parse(raw);
} catch (err) {
  console.error("Failed to parse AI classification:", err.message);

  return [
    {
      json: {
        slack_blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `⚠️ Issue #${meta.issue_number}: Classification Failed`,
              emoji: true,
            },
          },
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Automatic classification failed — *manual triage needed*.",
            },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "View Issue", emoji: true },
                url: meta.issue_url,
                style: "danger",
              },
            ],
          },
        ],
        slack_text: `⚠️ Issue #${meta.issue_number} (${meta.issue_title}) — classification failed, manual triage needed: ${meta.issue_url}`,
        classification: "unknown",
        priority: "P2",
        route_channel: "#incidents",
        labels_to_apply: [],
        ...meta,
      },
    },
  ];
}

// ── 3. Determine prefix emoji and channel ────────────────────────────────────
const type = classification.classification ?? "bug";
const priority = classification.priority ?? "P2";
const channel = classification.route_to ?? "#incidents";

const prefixMap = {
  bug: "🐛",
  security: "🔒",
  feature: "💡",
  question: "❓",
  documentation: "📄",
};
const emoji = prefixMap[type] ?? "📋";

const isUrgent =
  (type === "bug" || type === "security") &&
  (priority === "P0" || priority === "P1");
const urgentPrefix = isUrgent ? "🚨 " : "";

// ── 4. Build Slack Block Kit blocks ──────────────────────────────────────────
const blocks = [];

// Header
blocks.push({
  type: "header",
  text: {
    type: "plain_text",
    text: `${urgentPrefix}${emoji} Issue #${meta.issue_number}: ${meta.issue_title}`,
    emoji: true,
  },
});

// @channel mention for P0/P1 bugs/security
if (isUrgent) {
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
      text: `<!channel> *${priority} ${type.toUpperCase()}* needs immediate attention!`,
    },
  });
}

// AI reasoning
blocks.push({
  type: "section",
  text: {
    type: "mrkdwn",
    text: classification.reasoning,
  },
});

// Metadata fields
blocks.push({
  type: "section",
  fields: [
    { type: "mrkdwn", text: `*Author:*\n${meta.issue_author}` },
    { type: "mrkdwn", text: `*Classification:*\n${emoji} ${type}` },
    { type: "mrkdwn", text: `*Priority:*\n${priority}` },
    { type: "mrkdwn", text: `*Routed to:*\n${channel}` },
  ],
});

// Suggested labels
const labels = classification.suggested_labels ?? [];
if (labels.length > 0) {
  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `🏷️ *Labels:* ${labels.map((l) => "`" + l + "`").join("  ")}`,
      },
    ],
  });
}

// Divider + action button
blocks.push({ type: "divider" });
blocks.push({
  type: "actions",
  elements: [
    {
      type: "button",
      text: { type: "plain_text", text: "View Issue", emoji: true },
      url: meta.issue_url,
      style: isUrgent ? "danger" : "primary",
    },
  ],
});

// ── 5. Plain-text fallback ───────────────────────────────────────────────────
const slack_text = `${urgentPrefix}${emoji} Issue #${meta.issue_number} (${meta.issue_title}) — ${type} ${priority} → ${channel}: ${meta.issue_url}`;

// ── 6. Return everything downstream nodes need ──────────────────────────────
return [
  {
    json: {
      slack_blocks: blocks,
      slack_text,
      classification: type,
      priority,
      route_channel: channel,
      labels_to_apply: labels,
      reasoning: classification.reasoning,
      raw_ai_response: classification,
      // Pass through issue metadata for Supabase insert
      issue_number: meta.issue_number,
      issue_title: meta.issue_title,
      issue_author: meta.issue_author,
      issue_url: meta.issue_url,
      repo_full_name: meta.repo_full_name,
      ai_model_used: input.model ?? "unknown",
    },
  },
];
