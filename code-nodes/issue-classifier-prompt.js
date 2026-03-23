// issue-classifier-prompt.js
// N8N Code node — Phase 2: Issue Triage & Routing
// Receives a GitHub issue webhook payload and builds a structured AI prompt
// for classification, priority assignment, and channel routing.

// ── 1. Extract issue metadata from the webhook payload ───────────────────────
const payload = $input.all()[0].json.body;
const issue = payload.issue;
const repo = payload.repository.full_name;

const issueMeta = {
  issue_number: issue.number,
  issue_title: issue.title,
  issue_body: issue.body ?? "",
  issue_author: issue.user.login,
  issue_url: issue.html_url,
  existing_labels: (issue.labels ?? []).map((l) => l.name),
  repo_full_name: repo,
};

// ── 2. System instruction ────────────────────────────────────────────────────
const system_prompt =
  "You are a senior engineering manager triaging GitHub issues. " +
  "Classify each issue and assign a priority. " +
  "Respond ONLY with valid JSON, no markdown fences.";

// ── 3. Build user message ────────────────────────────────────────────────────
const user_prompt = `## GitHub Issue for Triage

**Issue #${issueMeta.issue_number}:** ${issueMeta.issue_title}
**Author:** ${issueMeta.issue_author}
**Repository:** ${issueMeta.repo_full_name}
**Existing labels:** ${issueMeta.existing_labels.length > 0 ? issueMeta.existing_labels.join(", ") : "none"}

### Issue Body
${issueMeta.issue_body || "(empty)"}

## Classification Task

1. **Classify** this issue into exactly one category:
   - **bug** — something is broken or not working as expected
   - **feature** — a request for new functionality or enhancement
   - **question** — the author is asking for help or clarification
   - **documentation** — missing, incorrect, or unclear docs
   - **security** — a vulnerability, exposure, or security concern

2. **Assign priority** using these definitions:
   - **P0** — system down or security breach; requires immediate response
   - **P1** — major functionality broken; needs fix within 24 hours
   - **P2** — important but not urgent; schedule for next sprint
   - **P3** — nice to have / minor improvement

3. **Route** to the appropriate Slack channel:
   - bug → #incidents
   - security → #incidents (always P0 or P1)
   - feature → #product
   - question → #support
   - documentation → #engineering

Respond with **only** a JSON object (no markdown, no extra text) containing exactly these fields:

{
  "classification": "bug|feature|question|documentation|security",
  "priority": "P0|P1|P2|P3",
  "reasoning": "1 sentence explaining the classification",
  "suggested_labels": ["array of GitHub labels to apply"],
  "route_to": "#channel-name based on the routing rules above"
}`;

// ── 4. Return prompts + pass-through metadata ────────────────────────────────
return [
  {
    json: {
      system_prompt,
      user_prompt,
      issue_metadata: issueMeta,
    },
  },
];
