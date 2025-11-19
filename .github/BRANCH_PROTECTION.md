# Branch Protection Configuration

This document explains how to protect important branches in this repository using GitHub branch protection rules.

## Overview

Branch protection rules help prevent accidental deletion, force pushes, and ensure that all changes go through proper review and testing before being merged into important branches like `main` or `master`.

## Protected Branches

The following branches should be protected:
- `main` (or `master` if using that naming convention)
- `production` (if applicable)
- `release/*` (release branches)

## Recommended Branch Protection Settings

### 1. Basic Protection Rules

Enable these settings for protected branches:

- ✅ **Require a pull request before merging**
  - Require approvals: **1** (or more based on your team size)
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from Code Owners (if you have a CODEOWNERS file)

- ✅ **Require status checks to pass before merging**
  - Required status checks:
    - `backend` (from CI workflow)
    - `frontend` (from CI workflow)
  - Require branches to be up to date before merging

- ✅ **Require conversation resolution before merging**
  - All comments and review suggestions must be resolved

- ✅ **Require linear history**
  - Prevents merge commits and ensures a clean, linear commit history

- ✅ **Require signed commits** (optional but recommended)
  - Ensures all commits are cryptographically signed

- ✅ **Do not allow bypassing the above settings**
  - Even administrators must follow these rules

### 2. Restrict Who Can Push

- ✅ **Restrict pushes that create matching branches**
  - Only allow specific users/teams to push to protected branches

### 3. Prevent Force Push and Deletion

- ✅ **Block force pushes**
  - Prevents `git push --force` to protected branches

- ✅ **Block deletion**
  - Prevents accidental branch deletion

## Setting Up Branch Protection

### Option 1: Via GitHub Web Interface (Recommended for most users)

1. Go to your repository on GitHub
2. Navigate to **Settings** → **Branches**
3. Click **Add rule** or edit an existing rule
4. Under **Branch name pattern**, enter `main` (or `master`)
5. Configure the settings as described above
6. Click **Create** (or **Save changes**)

### Option 2: Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
# macOS: brew install gh
# Linux: See https://cli.github.com/

# Authenticate
gh auth login

# Set up branch protection for main branch
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["backend","frontend"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1,"dismiss_stale_reviews":true}' \
  --field restrictions=null \
  --field required_linear_history=true \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

Replace `:owner` and `:repo` with your GitHub username/organization and repository name.

### Option 3: Via Setup Script

Use the provided setup script:

```bash
# Make the script executable
chmod +x .github/scripts/setup-branch-protection.sh

# Run the script (requires GitHub CLI)
./.github/scripts/setup-branch-protection.sh
```

### Option 4: Via GitHub API (REST)

See `.github/scripts/setup-branch-protection.sh` for a complete example using the GitHub API.

## Status Checks

The CI workflow (`.github/workflows/ci.yml`) runs the following checks:

- **backend**: Runs pytest for backend tests
- **frontend**: Runs linting and tests for frontend

These checks must pass before a pull request can be merged into a protected branch.

## Code Owners (Optional)

Create a `.github/CODEOWNERS` file to automatically request reviews from specific teams or individuals for certain files or directories:

```
# Global owners
* @your-team

# Backend code
/backend/ @backend-team

# Frontend code
/frontend/ @frontend-team

# Documentation
*.md @docs-team
```

## Branch Protection Rulesets (GitHub Enterprise)

If you're using GitHub Enterprise Cloud, you can use Rulesets for more advanced branch protection:

1. Go to **Settings** → **Rules** → **Rulesets**
2. Create a new ruleset
3. Configure rules for:
   - Branch protection
   - Pull request requirements
   - Status checks
   - Commit message patterns
   - File path restrictions

## Verification

After setting up branch protection, verify it's working:

1. Create a test branch: `git checkout -b test-branch-protection`
2. Make a small change and commit
3. Try to push directly to main: `git push origin test-branch-protection:main`
   - This should be blocked if protection is enabled
4. Create a pull request instead
5. Verify that status checks are required and must pass

## Troubleshooting

### Status checks not appearing

- Ensure the CI workflow file (`.github/workflows/ci.yml`) is in the repository
- Check that the workflow runs successfully at least once
- Verify job names match the required status check names

### Cannot push to protected branch

- This is expected behavior! Use pull requests instead
- If you need to push directly (e.g., for hotfixes), temporarily disable protection or use a bypass (if allowed)

### Approval requirements not working

- Ensure you have the correct number of reviewers
- Check that reviewers are not the same person who opened the PR
- Verify CODEOWNERS file is correct if using code owner reviews

## Additional Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Rulesets Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GitHub CLI Documentation](https://cli.github.com/manual/)

