// pr-diff-fetcher.js
// N8N Code node — Phase 1: PR Risk Analyzer
// Receives a GitHub webhook payload and fetches the full PR diff via the GitHub API.
// Returns PR metadata + truncated diff text for downstream AI analysis.

const MAX_DIFF_CHARS = 12000;

// ── 1. Extract PR metadata from the webhook payload ──────────────────────────
const payload = $input.all()[0].json.body;
const pr = payload.pull_request;
const repo = payload.repository.full_name; // e.g. "owner/repo"

const prMeta = {
  pr_number: pr.number,
  pr_title: pr.title,
  pr_author: pr.user.login,
  pr_url: pr.html_url,
  repo_full_name: repo,
  additions: pr.additions,
  deletions: pr.deletions,
  changed_files: pr.changed_files,
};

// ── 2. Fetch the list of files changed in this PR ────────────────────────────
let filesData = [];

try {
  const url = `https://api.github.com/repos/${repo}/pulls/${pr.number}/files`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${$env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `GitHub API responded ${response.status}: ${response.statusText}`,
    );
  }

  filesData = await response.json();
} catch (err) {
  // If the diff fetch fails, return metadata with a placeholder and log the error
  console.error("Failed to fetch PR diff:", err.message);

  return [
    {
      json: {
        ...prMeta,
        diff_text: "Diff unavailable",
        files_list: [],
      },
    },
  ];
}

// ── 3. Build per-file summaries and a combined diff string ───────────────────
const filesList = [];
let combinedDiff = "";

for (const file of filesData) {
  filesList.push(file.filename);

  // Each file section: header line + patch (the actual diff hunks)
  const section = [
    `--- ${file.filename} (${file.status}) +${file.additions} -${file.deletions}`,
    file.patch || "(binary or empty)",
    "", // blank line separator
  ].join("\n");

  combinedDiff += section;
}

// ── 4. Truncate the combined diff to fit within the AI context budget ────────
let diffText = combinedDiff;
if (diffText.length > MAX_DIFF_CHARS) {
  diffText = diffText.slice(0, MAX_DIFF_CHARS) + "\n... [diff truncated]";
}

// ── 5. Return a single item with PR metadata + diff ──────────────────────────
return [
  {
    json: {
      ...prMeta,
      diff_text: diffText,
      files_list: filesList,
    },
  },
];
