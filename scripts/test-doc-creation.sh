#!/bin/bash

# Test script for doc creation flow via simulation endpoint
# This simulates a merged PR webhook event to test the integration

set -e

# Configuration - update these values for your environment
WORKSPACE_ID="${WORKSPACE_ID:-your-workspace-id}"
API_URL="${API_URL:-http://localhost:3000}"
DEFAULT_SPACE_ID="${DEFAULT_SPACE_ID:-}"

# Test PR payload - simulates a merged PR with Linear issue key
PR_EVENT='{
  "action": "closed",
  "merged": true,
  "number": 999,
  "title": "TEST-123 Test doc creation flow",
  "body": "This is a test PR to verify the doc creation flow works correctly.",
  "url": "https://github.com/test/repo/pull/999",
  "html_url": "https://github.com/test/repo/pull/999",
  "head": { "ref": "feature/test-doc-creation" },
  "base": { "ref": "main" },
  "merged_at": "2026-06-10T12:00:00Z",
  "repository": {
    "full_name": "test/repo",
    "name": "repo",
    "owner": { "login": "test" }
  }
}'

echo "Testing doc creation flow..."
echo "Workspace ID: $WORKSPACE_ID"
echo "API URL: $API_URL"
echo ""

# Call the simulation endpoint
curl -X POST "$API_URL/api/integrations/composio/simulate" \
  -H "Content-Type: application/json" \
  -d "{
    \"workspace_id\": \"$WORKSPACE_ID\",
    \"default_space_id\": \"$DEFAULT_SPACE_ID\",
    \"event\": $PR_EVENT
  }" \
  | jq '.'

echo ""
echo "Test completed. Check your workspace for the created doc."
