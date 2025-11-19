#!/bin/bash

# Setup Branch Protection Script
# This script configures branch protection rules for important branches using GitHub CLI or API

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BRANCHES=("main" "master")
REQUIRED_APPROVALS=1
REQUIRED_STATUS_CHECKS=("backend" "frontend")

# Get repository info
REPO_INFO=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REPO_INFO" ]; then
    echo -e "${RED}❌ Error: Not a git repository or no remote configured${NC}"
    exit 1
fi

# Extract owner and repo from remote URL
if [[ $REPO_INFO =~ github\.com[:/]([^/]+)/([^/]+)(\.git)?$ ]]; then
    OWNER="${BASH_REMATCH[1]}"
    REPO="${BASH_REMATCH[2]%.git}"
else
    echo -e "${RED}❌ Error: Could not parse repository information from remote URL${NC}"
    echo "   Remote URL: $REPO_INFO"
    echo "   Please set OWNER and REPO environment variables manually:"
    echo "   export OWNER=your-username-or-org"
    echo "   export REPO=your-repo-name"
    exit 1
fi

# Allow override via environment variables
OWNER="${OWNER:-$GITHUB_OWNER}"
REPO="${REPO:-$GITHUB_REPO}"

if [ -z "$OWNER" ] || [ -z "$REPO" ]; then
    echo -e "${RED}❌ Error: Could not determine repository owner and name${NC}"
    exit 1
fi

echo -e "${GREEN}🔒 Setting up branch protection for repository: ${OWNER}/${REPO}${NC}"
echo ""

# Check if GitHub CLI is installed
if command -v gh &> /dev/null; then
    echo -e "${GREEN}✅ GitHub CLI found${NC}"
    
    # Check if authenticated
    if ! gh auth status &> /dev/null; then
        echo -e "${YELLOW}⚠️  GitHub CLI not authenticated. Please run: gh auth login${NC}"
        exit 1
    fi
    
    USE_GH_CLI=true
else
    echo -e "${YELLOW}⚠️  GitHub CLI not found. Will use curl with GitHub API${NC}"
    echo "   Install GitHub CLI for easier setup: https://cli.github.com/"
    USE_GH_CLI=false
    
    # Check for GitHub token
    if [ -z "$GITHUB_TOKEN" ]; then
        echo -e "${RED}❌ Error: GITHUB_TOKEN environment variable not set${NC}"
        echo "   Please set it: export GITHUB_TOKEN=your_token"
        echo "   Create a token at: https://github.com/settings/tokens"
        echo "   Required scopes: repo, admin:repo"
        exit 1
    fi
fi

# Function to set up protection for a branch
setup_branch_protection() {
    local branch=$1
    echo -e "${YELLOW}📋 Setting up protection for branch: ${branch}${NC}"
    
    # Build status checks JSON
    local status_checks_json="["
    for check in "${REQUIRED_STATUS_CHECKS[@]}"; do
        if [ "$status_checks_json" != "[" ]; then
            status_checks_json+=","
        fi
        status_checks_json+="\"$check\""
    done
    status_checks_json+="]"
    
    # Build protection payload
    local protection_payload=$(cat <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": $status_checks_json
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "required_approving_review_count": $REQUIRED_APPROVALS,
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
EOF
)
    
    if [ "$USE_GH_CLI" = true ]; then
        # Use GitHub CLI
        if gh api "repos/${OWNER}/${REPO}/branches/${branch}/protection" \
            --method PUT \
            --input - <<< "$protection_payload" 2>/dev/null; then
            echo -e "${GREEN}✅ Protection configured for ${branch}${NC}"
        else
            echo -e "${RED}❌ Failed to configure protection for ${branch}${NC}"
            echo "   This might be because:"
            echo "   - The branch doesn't exist yet"
            echo "   - You don't have admin permissions"
            echo "   - The repository doesn't exist or you don't have access"
            return 1
        fi
    else
        # Use GitHub API with curl
        local response=$(curl -s -w "\n%{http_code}" \
            -X PUT \
            -H "Authorization: token ${GITHUB_TOKEN}" \
            -H "Accept: application/vnd.github.v3+json" \
            -H "Content-Type: application/json" \
            -d "$protection_payload" \
            "https://api.github.com/repos/${OWNER}/${REPO}/branches/${branch}/protection")
        
        local http_code=$(echo "$response" | tail -n1)
        local body=$(echo "$response" | sed '$d')
        
        if [ "$http_code" = "200" ] || [ "$http_code" = "204" ]; then
            echo -e "${GREEN}✅ Protection configured for ${branch}${NC}"
        else
            echo -e "${RED}❌ Failed to configure protection for ${branch}${NC}"
            echo "   HTTP Status: $http_code"
            echo "   Response: $body"
            return 1
        fi
    fi
}

# Check which branches exist
echo "🔍 Checking which branches exist..."
existing_branches=()

for branch in "${BRANCHES[@]}"; do
    if git show-ref --verify --quiet "refs/remotes/origin/${branch}"; then
        existing_branches+=("$branch")
        echo -e "${GREEN}✅ Found branch: ${branch}${NC}"
    else
        echo -e "${YELLOW}⚠️  Branch not found: ${branch}${NC}"
    fi
done

if [ ${#existing_branches[@]} -eq 0 ]; then
    echo -e "${RED}❌ No branches to protect found${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}🚀 Setting up protection for ${#existing_branches[@]} branch(es)...${NC}"
echo ""

# Set up protection for each existing branch
failed=0
for branch in "${existing_branches[@]}"; do
    if ! setup_branch_protection "$branch"; then
        failed=$((failed + 1))
    fi
    echo ""
done

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✅ Branch protection setup complete!${NC}"
    echo ""
    echo "Protected branches:"
    for branch in "${existing_branches[@]}"; do
        echo "  - ${branch}"
    done
    echo ""
    echo "Protection rules enabled:"
    echo "  ✅ Require pull request before merging"
    echo "  ✅ Require ${REQUIRED_APPROVALS} approval(s)"
    echo "  ✅ Require status checks: ${REQUIRED_STATUS_CHECKS[*]}"
    echo "  ✅ Require linear history"
    echo "  ✅ Block force pushes"
    echo "  ✅ Block deletions"
    echo "  ✅ Require conversation resolution"
else
    echo -e "${YELLOW}⚠️  Setup completed with ${failed} error(s)${NC}"
    echo "   Some branches may not be protected. Check the errors above."
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

exit $failed

