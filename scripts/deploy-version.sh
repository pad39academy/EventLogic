#!/bin/bash

# Deploy Specific Version to Google Cloud Run
# Usage: ./scripts/deploy-version.sh <version>

if [ -z "$1" ]; then
    echo "❌ Please provide a version"
    echo "Usage: ./scripts/deploy-version.sh <version>"
    echo "Example: ./scripts/deploy-version.sh v1"
    exit 1
fi

VERSION="$1"

# Configuration
PROJECT_ID="ievolve-sports-2025"
REGION="asia-south1"
SERVICE_NAME="ievolve-app"
IMAGE_REGISTRY="asia-south1-docker.pkg.dev"
REPOSITORY="ievolve-repo"

FULL_IMAGE_URL="${IMAGE_REGISTRY}/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:${VERSION}"

echo "🚀 Deploying Ievolve Event Management System"
echo "=============================================="
echo "📦 Version: $VERSION"
echo "🖼️  Image: $FULL_IMAGE_URL"
echo "🌍 Region: $REGION"
echo ""

# Change to project root directory if we're in scripts/
if [ "$(basename "$PWD")" = "scripts" ]; then
    cd ..
fi

# Check if user is authenticated
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ No active Google Cloud authentication found"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Check if correct project is set
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "⚠️  Current project: $CURRENT_PROJECT"
    echo "🔄 Setting project to: $PROJECT_ID"
    gcloud config set project $PROJECT_ID
fi

# Build the Docker image with version tag
echo "🔨 Building Docker image for version $VERSION..."
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

# Push to Artifact Registry
echo "📤 Pushing image to registry..."
docker push $FULL_IMAGE_URL

if [ $? -ne 0 ]; then
    echo "❌ Docker push failed!"
    exit 1
fi

# Deploy to Cloud Run
echo "🚀 Deploying to Cloud Run..."
gcloud run deploy $SERVICE_NAME \
    --image=$FULL_IMAGE_URL \
    --region=$REGION \
    --allow-unauthenticated \
    --set-env-vars="DATABASE_URL=postgresql://ievolve_user:IevolveSecure2025!@/ievolve_db?host=/cloudsql/${PROJECT_ID}:${REGION}:ievolve-db,NODE_ENV=production" \
    --add-cloudsql-instances="${PROJECT_ID}:${REGION}:ievolve-db" \
    --set-secrets="TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,TWILIO_PHONE_NUMBER=twilio-phone-number:latest" \
    --memory=1Gi \
    --cpu=1 \
    --timeout=300 \
    --project=$PROJECT_ID

# Check deployment status
if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Version $VERSION deployed successfully!"
    echo ""
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" --project=$PROJECT_ID 2>/dev/null)
    
    if [ -n "$SERVICE_URL" ]; then
        echo "🌐 Application URL: $SERVICE_URL"
        echo ""
        echo "🧪 Quick Test Commands:"
        echo "   curl -I $SERVICE_URL"
        echo "   curl $SERVICE_URL/api/health"
    fi
    
    echo ""
    echo "📊 View logs:"
    echo "   gcloud run services logs read $SERVICE_NAME --region=$REGION"
    echo ""
else
    echo "❌ Deployment failed!"
    exit 1
fi