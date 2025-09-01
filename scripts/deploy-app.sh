#!/bin/bash

# Deploy Ievolve Event Management System to Google Cloud Run
# Usage: ./scripts/deploy-app.sh [tag]

# Configuration
PROJECT_ID="ievolve-sports-2025"
REGION="asia-south1"
SERVICE_NAME="ievolve-app"
IMAGE_REGISTRY="asia-south1-docker.pkg.dev"
REPOSITORY="ievolve-repo"

# Use provided tag or default to 'latest'
IMAGE_TAG=${1:-latest}
FULL_IMAGE_URL="${IMAGE_REGISTRY}/${PROJECT_ID}/${REPOSITORY}/${SERVICE_NAME}:${IMAGE_TAG}"

echo "🚀 Deploying Ievolve Event Management System"
echo "=============================================="
echo "📦 Image: $FULL_IMAGE_URL"
echo "🌍 Region: $REGION"
echo "🏷️  Service: $SERVICE_NAME"
echo ""

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

echo "🔄 Deploying to Cloud Run..."
echo ""

# Deploy to Cloud Run with all necessary configurations
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
    echo "✅ Deployment completed successfully!"
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
    echo "🔧 Manage service:"
    echo "   gcloud run services describe $SERVICE_NAME --region=$REGION"
    
else
    echo ""
    echo "❌ Deployment failed!"
    echo ""
    echo "🔍 Troubleshooting steps:"
    echo "1. Check if the image exists:"
    echo "   gcloud container images list-tags $IMAGE_REGISTRY/$PROJECT_ID/$REPOSITORY/$SERVICE_NAME"
    echo ""
    echo "2. Verify project permissions:"
    echo "   gcloud projects get-iam-policy $PROJECT_ID"
    echo ""
    echo "3. Check Cloud Run logs:"
    echo "   gcloud run services logs read $SERVICE_NAME --region=$REGION"
    
    exit 1
fi