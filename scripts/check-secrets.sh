#!/usr/bin/env bash
# Secret scanning with gitleaks
# Non-blocking check for sensitive data in git commits

set -e

# Check if gitleaks is installed
if ! command -v gitleaks &> /dev/null; then
    echo "⚠️  gitleaks not found - skipping secret scan"
    echo "   Install: brew install gitleaks"
    echo "   Or visit: https://github.com/gitleaks/gitleaks#installing"
    exit 0
fi

# Run gitleaks on staged changes only (fast)
echo "🔍 Scanning for secrets in staged files..."
if gitleaks protect --staged --verbose --config gitleaks.toml 2>&1; then
    echo "✅ No secrets detected"
else
    # Show warning but don't block commit (|| true makes it non-blocking)
    echo "⚠️  Potential secrets detected - please review above"
    exit 0
fi
