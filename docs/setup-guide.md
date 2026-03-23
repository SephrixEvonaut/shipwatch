# ShipWatch — Setup Guide

This guide walks through everything needed to get ShipWatch running locally: infrastructure, external accounts, configuration, and verification.

---

## 1. Prerequisites

Before starting, make sure you have:

- [ ] **Docker & Docker Compose** — [Install Docker Desktop](https://docs.docker.com/get-docker/) (includes Compose v2)
- [ ] **A GitHub account** with a test repository you control (public or private)
- [ ] **A Slack workspace** where you have permission to add apps and incoming webhooks
- [ ] **A Supabase account** — [sign up free](https://supabase.com) (no credit card required)
- [ ] **An AI API key** — either [Anthropic](https://console.anthropic.com) or [OpenAI](https://platform.openai.com)
- [ ] **A text editor** to modify `.env` (VS Code, Notepad++, etc.)
- [ ] **(Optional)** [ngrok](https://ngrok.com) or a similar tunnel for receiving webhooks on localhost

---

## 2. Supabase Setup

<!-- Screenshot: Supabase dashboard — new project creation -->

### 2.1 Create a Project

1. Log in to [app.supabase.com](https://app.supabase.com).
2. Click **New project**.
3. Choose your organization, give the project a name (e.g. `shipwatch`), set a database password, and pick a region close to you.
4. Wait for the project to finish provisioning (~1 minute).

### 2.2 Run the Schema

<!-- Screenshot: Supabase SQL Editor with schema pasted -->

1. In the left sidebar, click **SQL Editor**.
2. Click **New query**.
3. Open `scripts/supabase-schema.sql` from this repo and copy/paste the entire contents into the editor.
4. Click **Run** (or press Ctrl+Enter).
5. You should see `Success. No rows returned` — this means all four tables (`pr_analyses`, `issue_classifications`, `weekly_digests`, `escalations`), RLS policies, and indexes were created.

### 2.3 Copy Your API Credentials

<!-- Screenshot: Supabase Settings → API page -->

1. Go to **Settings → API** (in the left sidebar under the gear icon).
2. Copy the **Project URL** — this is your `SUPABASE_URL` (e.g. `https://abcdefg.supabase.co`).
3. Copy the **anon / public** key — this is your `SUPABASE_ANON_KEY`.
4. Paste both into your `.env` file (see Section 6).

---

## 3. GitHub Setup

### 3.1 Create a Personal Access Token

1. Go to [github.com/settings/tokens](https://github.com/settings/tokens).
2. Click **Generate new token (classic)**.
3. Give it a descriptive name (e.g. `shipwatch-bot`).
4. Select the **`repo`** scope (full control of private repositories). For public-only repos, `public_repo` is sufficient.
5. Click **Generate token** and copy the value immediately — you won't see it again.
6. This becomes your `GITHUB_TOKEN` in `.env`.

### 3.2 Configure Webhooks

On your test repository:

1. Go to **Settings → Webhooks → Add webhook**.
2. Fill in:
   - **Payload URL:** `http://your-server:5678/webhook/pr-webhook`
   - **Content type:** `application/json`
   - **Secret:** (leave blank for now, or set one for signature validation)
   - **Which events?** → Select **Let me select individual events**, then check:
     - ✅ **Pull requests**
     - ✅ **Issues**
3. Click **Add webhook**.

Repeat for the issue triage webhook if you use a separate URL:

- **Payload URL:** `http://your-server:5678/webhook/issue-webhook`
- Same event selections.

> **Local development with ngrok:**
>
> If N8N is running on your local machine, GitHub can't reach `localhost`. Use a tunnel:
>
> ```bash
> ngrok http 5678
> ```
>
> ngrok will give you a public URL like `https://a1b2c3d4.ngrok.io`. Use that as the base in your webhook Payload URL:
>
> ```
> https://a1b2c3d4.ngrok.io/webhook/pr-webhook
> https://a1b2c3d4.ngrok.io/webhook/issue-webhook
> ```
>
> The ngrok URL changes every time you restart unless you have a paid plan, so you'll need to update the GitHub webhook settings each time.

### 3.3 Set `GITHUB_REPO`

Your `.env` value should be in `owner/repo` format:

```
GITHUB_REPO=evonaut/my-test-repo
```

---

## 4. Slack Setup

### 4.1 Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps).
2. Click **Create New App → From scratch**.
3. Name it `ShipWatch` and select your workspace.

### 4.2 Enable Incoming Webhooks

1. In the app settings, go to **Incoming Webhooks** (left sidebar).
2. Toggle **Activate Incoming Webhooks** to **On**.

### 4.3 Create Channel Webhooks

You need a webhook for each channel ShipWatch posts to. For each one:

1. Click **Add New Webhook to Workspace**.
2. Select the target channel and click **Allow**.
3. Copy the webhook URL.

Create webhooks for these channels (create the channels first if they don't exist):

| Channel      | `.env` Variable             | Purpose                                           |
| ------------ | --------------------------- | ------------------------------------------------- |
| #engineering | `SLACK_WEBHOOK_ENGINEERING` | PR risk summaries, digest, warnings, error alerts |
| #incidents   | `SLACK_WEBHOOK_INCIDENTS`   | Bug and security issue notifications              |
| #product     | `SLACK_WEBHOOK_PRODUCT`     | Feature request notifications                     |
| #support     | `SLACK_WEBHOOK_SUPPORT`     | Question/support issue notifications              |
| #leads       | `SLACK_WEBHOOK_LEADS`       | Critical stale PR escalations                     |
| (default)    | `SLACK_WEBHOOK_URL`         | Fallback / general notifications                  |

> **Tip:** For initial testing, you can point all webhook variables at a single `#shipwatch-test` channel to keep things simple.

---

## 5. AI API Setup

You only need one of these — Claude (Anthropic) or GPT (OpenAI). The workflows default to Anthropic; switching to OpenAI requires a small HTTP node change (documented in each workflow JSON as a comment).

### Option A: Anthropic (Recommended)

1. Go to [console.anthropic.com](https://console.anthropic.com).
2. Create an account or log in.
3. Navigate to **API Keys** and create a new key.
4. Copy the key and set it in `.env`:
   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```
5. The workflows use `claude-sonnet-4-20250514` by default.

### Option B: OpenAI

1. Go to [platform.openai.com](https://platform.openai.com).
2. Create an account or log in.
3. Navigate to **API Keys** and create a new key.
4. Copy the key and set it in `.env`:
   ```
   OPENAI_API_KEY=sk-...
   ```
5. In each AI-calling workflow (01, 02, 03), update the HTTP Request node:
   - Change the URL to `https://api.openai.com/v1/chat/completions`
   - Replace the `x-api-key` header with `Authorization: Bearer {{ $env.OPENAI_API_KEY }}`
   - Update the JSON body to use the OpenAI message format with model `gpt-4o-mini`

---

## 6. Configure Environment Variables

1. Copy the example file:

   ```bash
   cp .env.example .env
   ```

2. Open `.env` in your editor and fill in every value:

   ```env
   # ── N8N + Postgres ─────────────────────────────────────
   POSTGRES_USER=n8n
   POSTGRES_PASSWORD=<strong-random-password>
   POSTGRES_DB=n8n
   N8N_ENCRYPTION_KEY=<random-32-char-string>

   # ── GitHub ─────────────────────────────────────────────
   GITHUB_TOKEN=ghp_...
   GITHUB_REPO=your-org/your-repo

   # ── AI ─────────────────────────────────────────────────
   ANTHROPIC_API_KEY=sk-ant-...
   # OPENAI_API_KEY=sk-...          # uncomment if using OpenAI

   # ── Slack Webhooks ─────────────────────────────────────
   SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
   SLACK_WEBHOOK_ENGINEERING=https://hooks.slack.com/services/...
   SLACK_WEBHOOK_INCIDENTS=https://hooks.slack.com/services/...
   SLACK_WEBHOOK_PRODUCT=https://hooks.slack.com/services/...
   SLACK_WEBHOOK_SUPPORT=https://hooks.slack.com/services/...
   SLACK_WEBHOOK_LEADS=https://hooks.slack.com/services/...

   # ── Supabase ───────────────────────────────────────────
   SUPABASE_URL=https://abcdefg.supabase.co
   SUPABASE_ANON_KEY=eyJ...

   # ── Email (optional) ──────────────────────────────────
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=you@gmail.com
   SMTP_PASS=app-password
   ESCALATION_EMAIL=oncall@yourteam.com
   DIGEST_EMAIL_LIST=team@yourteam.com
   ```

> **Security reminder:** The `.env` file is in `.gitignore` and must never be committed.

---

## 7. Launch & Import

### 7.1 Start the Stack

```bash
docker compose up -d
```

This starts two containers:

- **n8n** on port `5678`
- **postgres** on port `5432` (internal only)

Verify both are running:

```bash
docker compose ps
```

### 7.2 Open N8N

Navigate to [http://localhost:5678](http://localhost:5678) in your browser. On first launch, you'll create an owner account (email + password). This is local only.

### 7.3 Import Workflows

1. In N8N, go to the **Workflows** page.
2. Click the **⋮** menu (or **Import from File**).
3. Import each workflow JSON one at a time:
   - `workflows/01-pr-risk-analyzer.json`
   - `workflows/02-issue-triage-router.json`
   - `workflows/03-weekly-health-digest.json`
   - `workflows/04-stale-pr-escalation.json`

### 7.4 Configure Credentials (if needed)

Some nodes (like Email Send) reference credential IDs. If you see a credentials warning:

1. Go to **Settings → Credentials → Add Credential**.
2. Select **SMTP** and fill in your SMTP details.
3. Re-open the workflow and re-link the credential to the email node.

### 7.5 Activate All Workflows

For each imported workflow, toggle the **Active** switch in the top-right corner of the editor. Webhook-triggered workflows (01, 02) must be active to receive events. Cron-triggered workflows (03, 04) must be active to run on schedule.

### 7.6 Verify

1. **PR Risk Analyzer** — Open a PR on your test repo. Within a few seconds, a risk-scored Slack message should appear in #engineering.
2. **Issue Triage Router** — Create an issue on your test repo. A classified and routed message should appear in the appropriate Slack channel, and labels should be applied to the issue on GitHub.
3. **Weekly Digest** — Click **Execute Workflow** in the N8N editor to run it manually (don't wait until Monday).
4. **Stale PR Escalation** — Click **Execute Workflow** to run it manually. If you have any open PRs older than 48 hours, they'll show up.

---

## 8. Troubleshooting

### Webhooks not receiving events

| Symptom                                   | Fix                                                                                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| GitHub shows "Last delivery: failed"      | Check that the Payload URL is correct and reachable. If running locally, ensure ngrok is running and the URL matches.    |
| GitHub shows "200 OK" but nothing happens | Make sure the workflow is **Active** in N8N (toggle in top-right). Inactive workflows don't listen on webhook endpoints. |
| Events arrive but workflow errors         | Open the workflow in N8N → **Executions** tab → click the failed execution to inspect which node failed and its output.  |

### AI API errors

| Symptom                               | Fix                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `401 Unauthorized`                    | Your API key is invalid or expired. Regenerate it and update `.env`, then restart: `docker compose restart n8n`.                               |
| `429 Too Many Requests`               | You've hit the rate limit. Wait a few minutes, or upgrade your API plan.                                                                       |
| `500` / timeout from Anthropic/OpenAI | Transient outage. The error handler will alert in Slack. Retry by re-triggering the event or executing the workflow manually.                  |
| AI returns unparseable response       | The formatters have try/catch fallbacks — you'll still get a Slack message with raw metadata. Check the execution log for the raw AI response. |

### Supabase errors

| Symptom                               | Fix                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `403 Forbidden` / `permission denied` | RLS policies may not have been created. Re-run `scripts/supabase-schema.sql` in the SQL Editor.                       |
| `404 Not Found` on REST endpoint      | Double-check `SUPABASE_URL` — it should be `https://your-project-ref.supabase.co` (no trailing slash, no `/rest/v1`). |
| `401` on Supabase requests            | Your `SUPABASE_ANON_KEY` is wrong. Re-copy it from Settings → API.                                                    |

### Docker issues

| Symptom                                    | Fix                                                                                                                                          |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `port 5678 already in use`                 | Another process is using that port. Stop it, or change the port mapping in `docker-compose.yml`.                                             |
| N8N container keeps restarting             | Check logs: `docker compose logs n8n`. Common cause: `N8N_ENCRYPTION_KEY` changed after initial setup (N8N can't decrypt saved credentials). |
| Environment variable changes not picked up | After editing `.env`, restart: `docker compose down && docker compose up -d`.                                                                |

### General tips

- **Inspect executions:** N8N keeps a log of every execution. Go to the workflow → **Executions** tab to see inputs/outputs at every node.
- **Test nodes individually:** In the N8N editor, you can click any node and hit **Execute Node** to test it in isolation with pinned input data.
- **Re-import workflows:** If a workflow gets into a weird state, delete it and re-import the JSON. Workflow JSON is the source of truth.

---

## Next Steps

Once everything is running:

- Add real screenshots to the [README](../README.md) (replace the `<!-- Screenshot: ... -->` placeholders).
- Configure [GitHub webhook secret validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries) for production use.
- Set up a reverse proxy (nginx, Caddy) with HTTPS if exposing N8N to the internet.
- Tune the stale PR thresholds in `code-nodes/stale-pr-filter.js` (default: 48h warning, 120h critical).
