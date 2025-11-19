# Branch Protection Quick Start

## 🚀 Quick Setup (5 minutes)

### Prerequisites
- GitHub repository with admin access
- GitHub CLI installed (optional but recommended) OR GitHub personal access token

### Option 1: Automated Setup (Recommended)

```bash
# Install GitHub CLI (if not installed)
# macOS: brew install gh
# Linux: See https://cli.github.com/

# Authenticate
gh auth login

# Run the setup script
./.github/scripts/setup-branch-protection.sh
```

That's it! The script will:
- ✅ Detect your repository automatically
- ✅ Protect `main` and `master` branches
- ✅ Require pull requests with 1 approval
- ✅ Require CI status checks to pass
- ✅ Block force pushes and deletions
- ✅ Require linear commit history

### Option 2: Manual Setup via GitHub Web UI

1. Go to your repository on GitHub
2. Click **Settings** → **Branches**
3. Click **Add rule**
4. Enter branch name: `main`
5. Enable these settings:
   - ✅ Require a pull request before merging
     - Require approvals: **1**
     - ✅ Dismiss stale reviews
   - ✅ Require status checks to pass before merging
     - ✅ Require branches to be up to date
     - Select: `backend` and `frontend`
   - ✅ Require conversation resolution before merging
   - ✅ Require linear history
   - ✅ Do not allow bypassing the above settings
   - ✅ Block force pushes
   - ✅ Block deletions
6. Click **Create**

### Option 3: Using GitHub API

```bash
# Set your GitHub token
export GITHUB_TOKEN=your_token_here

# Set repository info
export OWNER=your-username-or-org
export REPO=optiroute

# Run the script
./.github/scripts/setup-branch-protection.sh
```

## ✅ What Gets Protected

After setup, these rules apply to protected branches:

| Rule | Description |
|------|-------------|
| **Pull Request Required** | All changes must go through a PR |
| **1 Approval Required** | At least 1 reviewer must approve |
| **Status Checks** | CI tests (`backend` and `frontend`) must pass |
| **Linear History** | No merge commits allowed |
| **No Force Push** | `git push --force` is blocked |
| **No Deletion** | Branch cannot be deleted |
| **Conversation Resolution** | All PR comments must be resolved |

## 🧪 Verify It's Working

1. Create a test branch:
   ```bash
   git checkout -b test-protection
   ```

2. Make a change and try to push directly to main:
   ```bash
   git push origin test-protection:main
   ```
   This should be **blocked** ✅

3. Instead, create a pull request:
   ```bash
   git push origin test-protection
   ```
   Then create a PR on GitHub. You'll see:
   - Status checks are required
   - Approval is required
   - Cannot merge until checks pass

## 📚 More Information

For detailed configuration options and troubleshooting, see:
- [BRANCH_PROTECTION.md](BRANCH_PROTECTION.md) - Complete documentation
- [GitHub Branch Protection Docs](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)

## 🔧 Customization

Edit `.github/scripts/setup-branch-protection.sh` to customize:
- Number of required approvals
- Which branches to protect
- Additional status checks
- Other protection rules

