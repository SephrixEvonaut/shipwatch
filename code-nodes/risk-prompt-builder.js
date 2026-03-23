// risk-prompt-builder.js
// N8N Code node — Phase 1: PR Risk Analyzer
// Builds structured system + user prompts for AI-based PR risk classification.
// Receives the output of pr-diff-fetcher.js and passes everything downstream.

// ── 1. Grab diff-fetcher output ──────────────────────────────────────────────
const input = $input.all()[0].json;

// ── 2. System instruction ────────────────────────────────────────────────────
const system_prompt =
  "You are a senior software engineer reviewing pull requests. " +
  "Classify the risk level and provide a brief summary. " +
  "Respond ONLY with valid JSON, no markdown fences.";

// ── 3. Build the user message ────────────────────────────────────────────────
const user_prompt = `## Pull Request for Review

**Title:** ${input.pr_title}
**Author:** ${input.pr_author}
**Files changed:** ${input.changed_files}
**Lines added:** ${input.additions}
**Lines removed:** ${input.deletions}

### Files Changed
${input.files_list.map((f) => `- ${f}`).join("\n")}

### Diff
\`\`\`
${input.diff_text}
\`\`\`

## Classification Task

Classify this PR into exactly one risk level using these criteria:

- **low** — documentation, tests, config tweaks, typo fixes
- **medium** — new features with tests, refactors of non-critical paths
- **high** — changes to auth, payments, database schemas, core business logic, or PRs with no tests
- **critical** — security-related changes, breaking API changes, infrastructure / deployment changes

Respond with **only** a JSON object (no markdown, no extra text) containing exactly these fields:

{
  "risk_level": "low|medium|high|critical",
  "summary": "2-3 sentence summary of what this PR does and why it has this risk level",
  "key_concerns": ["array of specific concerns if medium/high/critical, empty array for low"],
  "suggested_reviewers": ["areas of expertise needed, e.g. 'database', 'security', 'frontend'"]
}`;

// ── 4. Pass through PR metadata so downstream nodes can store it ─────────────
const pr_metadata = {
  pr_number: input.pr_number,
  pr_title: input.pr_title,
  pr_author: input.pr_author,
  pr_url: input.pr_url,
  repo_full_name: input.repo_full_name,
  additions: input.additions,
  deletions: input.deletions,
  changed_files: input.changed_files,
  diff_text: input.diff_text,
  files_list: input.files_list,
};

// ── 5. Return single item ────────────────────────────────────────────────────
return [
  {
    json: {
      system_prompt,
      user_prompt,
      pr_metadata,
    },
  },
];
