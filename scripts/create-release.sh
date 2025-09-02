#!/bin/bash

# Create Release Script for Ievolve Event Management System
# Usage: ./scripts/create-release.sh [version]

echo "🚀 Creating Release for Ievolve Event Management System"
echo "======================================================="

# Get current branch
CURRENT_BRANCH=$(git branch --show-current)

# Check if we're on a feature branch
if [[ $CURRENT_BRANCH != feature/* ]]; then
    echo "❌ Must be on a feature branch to create a release"
    echo "Current branch: $CURRENT_BRANCH"
    echo ""
    echo "📝 Create a feature branch first:"
    echo "   ./scripts/create-feature-branch.sh <feature-name>"
    exit 1
fi

# Get the next version number
LAST_TAG=$(git tag --sort=-version:refname | grep "^v[0-9]*$" | head -n1)
if [ -z "$LAST_TAG" ]; then
    NEXT_VERSION="v1"
else
    LAST_NUM=${LAST_TAG#v}
    NEXT_NUM=$((LAST_NUM + 1))
    NEXT_VERSION="v$NEXT_NUM"
fi

# Allow override of version
VERSION=${1:-$NEXT_VERSION}

echo "🏷️  Current branch: $CURRENT_BRANCH"
echo "📦 Next version: $VERSION"
echo ""

# Confirm release
read -p "🤔 Create release $VERSION from $CURRENT_BRANCH? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Release cancelled"
    exit 1
fi

echo ""
echo "🔄 Processing release..."

# Ensure all changes are committed
if [ -n "$(git status --porcelain)" ]; then
    echo "📝 Uncommitted changes detected. Committing..."
    git add .
    git commit -m "Complete feature for release $VERSION"
fi

# Push feature branch
echo "📤 Pushing feature branch..."
git push origin "$CURRENT_BRANCH"

# Switch to main and merge
echo "🔄 Switching to main..."
git checkout main

echo "📥 Pulling latest main..."
git pull origin main

echo "🔀 Merging feature branch..."
git merge --no-ff "$CURRENT_BRANCH" -m "Merge $CURRENT_BRANCH for release $VERSION"

# Create and push tag
echo "🏷️  Creating tag $VERSION..."
git tag -a "$VERSION" -m "Release $VERSION"

echo "📤 Pushing main and tags..."
git push origin main
git push origin "$VERSION"

# Clean up feature branch
echo "🧹 Cleaning up feature branch..."
git branch -d "$CURRENT_BRANCH"
git push origin --delete "$CURRENT_BRANCH"

echo ""
echo "✅ Release $VERSION created successfully!"
echo ""
echo "🚀 Automatic deployment will start shortly via GitHub Actions"
echo "📊 Monitor deployment status at: https://github.com/your-repo/actions"
echo ""