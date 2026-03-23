#!/usr/bin/env bash
# seed-test-data.sh
# Creates test PRs and issues in a GitHub repo to demonstrate ShipWatch.
# Usage: ./scripts/seed-test-data.sh [owner/repo]
# Falls back to $GITHUB_REPO env var if no argument is provided.

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

info()    { echo -e "${CYAN}ℹ ${NC}$1"; }
success() { echo -e "${GREEN}✔ ${NC}$1"; }
warn()    { echo -e "${YELLOW}⚠ ${NC}$1"; }
error()   { echo -e "${RED}✖ ${NC}$1"; exit 1; }

# ── Preflight ─────────────────────────────────────────────────────────────────
REPO="${1:-${GITHUB_REPO:-}}"
if [[ -z "$REPO" ]]; then
  error "No repo specified. Pass owner/repo as an argument or set GITHUB_REPO."
fi

if ! command -v gh &>/dev/null; then
  error "GitHub CLI (gh) is not installed. Install it: https://cli.github.com"
fi

if ! gh auth status &>/dev/null; then
  error "GitHub CLI is not authenticated. Run: gh auth login"
fi

info "Target repo: ${BOLD}${REPO}${NC}"
echo ""

# We'll clone into a temp dir so we can create branches and files.
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

info "Cloning ${REPO} into temp directory..."
gh repo clone "$REPO" "$TMPDIR/repo" -- --depth=1 --quiet 2>/dev/null \
  || error "Failed to clone ${REPO}. Check that the repo exists and you have access."
cd "$TMPDIR/repo"

# Get the default branch name
DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
info "Default branch: ${BOLD}${DEFAULT_BRANCH}${NC}"
echo ""

# Track created resources for the summary
declare -a PR_URLS=()
declare -a ISSUE_URLS=()

# ══════════════════════════════════════════════════════════════════════════════
# PR 1 — Low Risk: README update
# ══════════════════════════════════════════════════════════════════════════════
info "Creating PR 1/3 — ${BOLD}fix/update-readme${NC} (low risk)..."

git checkout -b fix/update-readme origin/"$DEFAULT_BRANCH" --quiet

cat >> README.md <<'EOF'

---

## Contributing

We welcome contributions! Please open a pull request against the `main` branch.
Make sure to include tests and update documentation as needed.
EOF

git add README.md
git commit -m "docs: update README with contributing section" --quiet
git push origin fix/update-readme --quiet 2>/dev/null

PR1_URL=$(gh pr create \
  --repo "$REPO" \
  --base "$DEFAULT_BRANCH" \
  --head fix/update-readme \
  --title "docs: update README formatting" \
  --body "Minor documentation update — adds a contributing section to the README.

This is a low-risk change: documentation only, no code modifications.

**Changes:**
- Added Contributing section to README.md" \
  2>/dev/null)

PR_URLS+=("$PR1_URL")
success "PR created: ${PR1_URL}"

# ══════════════════════════════════════════════════════════════════════════════
# PR 2 — High Risk: Auth middleware
# ══════════════════════════════════════════════════════════════════════════════
info "Creating PR 2/3 — ${BOLD}feat/add-user-auth${NC} (high risk)..."

git checkout "$DEFAULT_BRANCH" --quiet
git checkout -b feat/add-user-auth origin/"$DEFAULT_BRANCH" --quiet

mkdir -p src/middleware

cat > src/middleware/auth-handler.js <<'AUTHEOF'
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_EXPIRY = '24h';

/**
 * Middleware: authenticate incoming requests via Bearer token.
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

/**
 * Hash a plaintext password.
 */
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

/**
 * Compare a plaintext password against a hash.
 */
async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Generate a signed JWT for the given user payload.
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

module.exports = { authenticateToken, hashPassword, comparePassword, generateToken };
AUTHEOF

git add src/middleware/auth-handler.js
git commit -m "feat: add user authentication middleware" --quiet
git push origin feat/add-user-auth --quiet 2>/dev/null

PR2_URL=$(gh pr create \
  --repo "$REPO" \
  --base "$DEFAULT_BRANCH" \
  --head feat/add-user-auth \
  --title "feat: add user authentication middleware" \
  --body "Adds JWT-based authentication middleware with bcrypt password hashing.

This is a **high-risk** change — introduces new authentication logic, new dependencies (jsonwebtoken, bcryptjs), and touches the request pipeline for all protected routes.

**Changes:**
- New file: \`src/middleware/auth-handler.js\`
- JWT token verification middleware
- Password hashing and comparison utilities
- Token generation with configurable expiry

**Security considerations:**
- JWT_SECRET loaded from environment variable
- bcrypt salt rounds set to 12
- Token expiry set to 24 hours" \
  2>/dev/null)

PR_URLS+=("$PR2_URL")
success "PR created: ${PR2_URL}"

# ══════════════════════════════════════════════════════════════════════════════
# PR 3 — Critical Risk: Database migration
# ══════════════════════════════════════════════════════════════════════════════
info "Creating PR 3/3 — ${BOLD}fix/update-db-schema${NC} (critical risk)..."

git checkout "$DEFAULT_BRANCH" --quiet
git checkout -b fix/update-db-schema origin/"$DEFAULT_BRANCH" --quiet

mkdir -p migrations

cat > migrations/002-user-table-v2.sql <<'SQLEOF'
-- Migration: 002-user-table-v2
-- Description: Restructure user table for v2 auth system
-- WARNING: This migration modifies production user data

BEGIN;

-- Add new columns for v2 auth
ALTER TABLE users ADD COLUMN auth_provider VARCHAR(50) DEFAULT 'local';
ALTER TABLE users ADD COLUMN external_id VARCHAR(255);
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN mfa_secret TEXT;
ALTER TABLE users ADD COLUMN last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN locked_until TIMESTAMPTZ;

-- Migrate existing password hashes to new column name
ALTER TABLE users RENAME COLUMN password TO password_hash;

-- Drop legacy columns
ALTER TABLE users DROP COLUMN IF EXISTS legacy_session_token;
ALTER TABLE users DROP COLUMN IF EXISTS old_role_id;

-- Add constraints
ALTER TABLE users ADD CONSTRAINT chk_auth_provider
  CHECK (auth_provider IN ('local', 'google', 'github', 'saml'));

-- Create indexes for new query patterns
CREATE INDEX idx_users_auth_provider ON users (auth_provider);
CREATE INDEX idx_users_external_id ON users (external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_users_locked ON users (locked_until) WHERE locked_until IS NOT NULL;

-- Backfill auth_provider for existing users
UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL;

COMMIT;
SQLEOF

git add migrations/002-user-table-v2.sql
git commit -m "fix: migrate user table schema for v2" --quiet
git push origin fix/update-db-schema --quiet 2>/dev/null

PR3_URL=$(gh pr create \
  --repo "$REPO" \
  --base "$DEFAULT_BRANCH" \
  --head fix/update-db-schema \
  --title "fix: migrate user table schema for v2" \
  --body "Database migration to restructure the users table for the v2 authentication system.

This is a **critical-risk** change — it modifies production database schema, renames columns, drops legacy columns, and backfills data.

**Changes:**
- ALTER TABLE on users: add 7 new columns
- RENAME COLUMN password → password_hash
- DROP 2 legacy columns
- Add CHECK constraint on auth_provider
- Create 3 new indexes
- Backfill UPDATE on all existing rows

**Rollback plan:**
A reverse migration should be prepared before applying to production.

**Requires:** DBA review, staging validation, maintenance window." \
  2>/dev/null)

PR_URLS+=("$PR3_URL")
success "PR created: ${PR3_URL}"
echo ""

# ══════════════════════════════════════════════════════════════════════════════
# Issues
# ══════════════════════════════════════════════════════════════════════════════
info "Creating test issues..."

ISSUE1_URL=$(gh issue create \
  --repo "$REPO" \
  --title "Bug: Login page returns 500 on invalid credentials" \
  --body "## Description

When a user enters invalid credentials on the login page (\`/auth/login\`), the server returns a 500 Internal Server Error instead of a 401 with a user-friendly message.

## Steps to Reproduce

1. Go to https://app.example.com/auth/login
2. Enter email: \`test@example.com\`
3. Enter password: \`wrongpassword\`
4. Click **Sign In**

## Expected Behavior

- Return 401 status
- Show error message: \"Invalid email or password\"

## Actual Behavior

- Returns 500 Internal Server Error
- Stack trace visible in browser console:
  \`\`\`
  TypeError: Cannot read properties of undefined (reading 'password_hash')
  at AuthController.login (src/controllers/auth.js:42)
  \`\`\`

## Impact

- Users cannot distinguish between wrong credentials and a system error
- Unhandled exception may indicate a deeper issue in the auth flow
- Affects all users attempting to log in with incorrect passwords

## Environment

- Browser: Chrome 120, Firefox 121
- API version: v1.4.2
- First observed: 2 hours ago" \
  2>/dev/null)

ISSUE_URLS+=("$ISSUE1_URL")
success "Issue created: ${ISSUE1_URL}"

ISSUE2_URL=$(gh issue create \
  --repo "$REPO" \
  --title "Feature: Add dark mode support" \
  --body "## Feature Request

It would be great to have a dark mode option in the application UI.

## Motivation

- Reduces eye strain during nighttime usage
- Increasingly standard in modern web apps
- Several users have requested this in our feedback channel

## Suggested Implementation

1. Add a theme toggle in the user settings page
2. Use CSS custom properties for theme colors
3. Persist preference in localStorage and user profile
4. Default to system preference via \`prefers-color-scheme\` media query

## Scope

This is a purely cosmetic change — no backend modifications needed. Could be implemented incrementally, starting with the main dashboard and expanding to other pages.

## Priority

Low — nice to have, not blocking any workflows." \
  2>/dev/null)

ISSUE_URLS+=("$ISSUE2_URL")
success "Issue created: ${ISSUE2_URL}"

ISSUE3_URL=$(gh issue create \
  --repo "$REPO" \
  --title "Question: How do I configure SSO?" \
  --body "## Question

We're evaluating this project for our team and need SSO (Single Sign-On) integration with our company's identity provider (Okta).

## What I've tried

- Checked the docs but didn't find SSO-specific setup instructions
- Looked through the auth middleware code but it seems to only support local auth
- Searched existing issues — no prior discussion on SSO

## Specific questions

1. Is SAML-based SSO supported or on the roadmap?
2. If not built-in, what's the recommended approach for adding it? (e.g., passport-saml, Auth0, etc.)
3. Are there any configuration points where we could plug in an external auth provider?

Thanks in advance!" \
  2>/dev/null)

ISSUE_URLS+=("$ISSUE3_URL")
success "Issue created: ${ISSUE3_URL}"

# ══════════════════════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BOLD}  🚢 ShipWatch Test Data — Summary${NC}"
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BOLD}Pull Requests:${NC}"
echo -e "  ${GREEN}LOW${NC}      ${PR_URLS[0]}"
echo -e "  ${YELLOW}HIGH${NC}     ${PR_URLS[1]}"
echo -e "  ${RED}CRITICAL${NC} ${PR_URLS[2]}"
echo ""
echo -e "${BOLD}Issues:${NC}"
echo -e "  🐛 Bug      ${ISSUE_URLS[0]}"
echo -e "  💡 Feature   ${ISSUE_URLS[1]}"
echo -e "  ❓ Question  ${ISSUE_URLS[2]}"
echo ""
echo -e "${BOLD}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}Now watch your Slack channels for ShipWatch alerts!${NC}"
echo -e "  • PR risk classifications   → #engineering"
echo -e "  • Bug/security issues       → #incidents"
echo -e "  • Feature requests          → #product"
echo -e "  • Questions                 → #support"
echo ""
echo -e "${YELLOW}Note:${NC} Webhook delivery can take a few seconds. If you don't see"
echo -e "alerts, check the workflow executions in N8N at http://localhost:5678"
echo ""
