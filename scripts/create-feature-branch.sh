#!/bin/bash

# Create Feature Branch Script for Ievolve Event Management System
# Usage: ./scripts/create-feature-branch.sh <feature-name>

if [ -z "$1" ]; then
    echo "❌ Please provide a feature name"
    echo "Usage: ./scripts/create-feature-branch.sh <feature-name>"
    echo "Example: ./scripts/create-feature-branch.sh hotel-management"
    exit 1
fi

FEATURE_NAME="$1"
BRANCH_NAME="feature/$FEATURE_NAME"

echo "🌟 Creating Feature Branch for Ievolve Event Management"
echo "======================================================"
echo "🏷️  Feature: $FEATURE_NAME"
echo "🌳 Branch: $BRANCH_NAME"
echo ""

# Ensure we're on main and up to date
echo "🔄 Switching to main branch..."
git checkout main

echo "📥 Pulling latest changes..."
git pull origin main

# Create and switch to feature branch
echo "🌿 Creating feature branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

echo "📤 Pushing feature branch to origin..."
git push -u origin "$BRANCH_NAME"

echo ""
echo "✅ Feature branch created successfully!"
echo ""
echo "📝 Next Steps:"
echo "   1. Make your changes"
echo "   2. Commit and push: git add . && git commit -m 'Add feature: $FEATURE_NAME'"
echo "   3. Create release: ./scripts/create-release.sh"
echo ""