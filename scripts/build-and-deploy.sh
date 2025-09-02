#!/bin/bash

# Complete build and deployment pipeline for Ievolve Event Management System
# Usage: ./scripts/build-and-deploy.sh [tag]

# Configuration
PROJECT_ID="ievolve-sports-2025"
REGION="asia-south1"
SERVICE_NAME="ievolve-app"
IMAGE_REGISTRY="asia-south1-docker.pkg.dev"
REPOSITORY="ievolve-repo"

# Use provided tag or generate timestamp-based tag
if [ -n "$1" ]; then
    IMAGE_TAG="$1"
else
    IMAGE_TAG="v$(date +%Y%m%d-%H%M%S)"
fi

FULL_IMAGE_URL="${IMAGE_REGISTRY}/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:${IMAGE_TAG}"

echo "🔨 Building and Deploying Ievolve Event Management System"
echo "=========================================================="
echo "📦 Image: $FULL_IMAGE_URL"
echo "🌍 Region: $REGION"
echo "🏷️  Service: $SERVICE_NAME"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check if Docker is configured for Artifact Registry
if ! gcloud auth list --filter="account~docker" --format="value(account)" | grep -q .; then
    echo "🔧 Configuring Docker authentication..."
    gcloud auth configure-docker ${REGION}-docker.pkg.dev
fi

# Change to project root directory if we're in scripts/
if [ "$(basename "$PWD")" = "scripts" ]; then
    cd ..
fi

# Check if Dockerfile exists
if [ ! -f "Dockerfile-fixed" ]; then
    echo "❌ Dockerfile-fixed not found in current directory"
    echo "Please ensure you're in the project root directory"
    exit 1
fi

# Step 1: Build the Docker image
echo ""
echo "🔨 Step 1: Building Docker image..."
echo "Image: $FULL_IMAGE_URL"

docker buildx build \
    --no-cache \
    --platform linux/amd64 \
    -f Dockerfile-fixed \
    -t $FULL_IMAGE_URL \
    .

if [ $? -ne 0 ]; then
    echo "❌ Docker build failed!"
    exit 1
fi

echo "✅ Docker image built successfully"

# Step 2: Push to Artifact Registry
echo ""
echo "📤 Step 2: Pushing to Artifact Registry..."

docker push $FULL_IMAGE_URL

if [ $? -ne 0 ]; then
    echo "❌ Docker push failed!"
    exit 1
fi

echo "✅ Image pushed to registry"

# Step 3: Deploy to Cloud Run
echo ""
echo "🚀 Step 3: Deploying to Cloud Run..."

./scripts/deploy-app.sh $IMAGE_TAG

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 Complete deployment pipeline finished successfully!"
    echo ""
    echo "📝 Deployment Summary:"
    echo "   Image: $FULL_IMAGE_URL"
    echo "   Service: $SERVICE_NAME"
    echo "   Region: $REGION"
    echo "   Tag: $IMAGE_TAG"
    echo ""
    echo "🔗 Quick links:"
    echo "   Console: https://console.cloud.google.com/run/detail/$REGION/$SERVICE_NAME"
    echo "   Logs: https://console.cloud.google.com/logs/query"
else
    echo ""
    echo "❌ Deployment pipeline failed at Cloud Run deployment step"
    exit 1
fi