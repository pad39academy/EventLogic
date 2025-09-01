#!/bin/bash

# Quick actions for Ievolve Cloud Service management
# Usage: ./scripts/quick-actions.sh

PROJECT_ID="ievolve-sports-2025"
SERVICE_NAME="ievolve-app"
REGION="asia-south1"

echo "🚀 Ievolve Cloud Service Quick Actions"
echo "======================================"
echo ""

# Check if gcloud is available
if ! command -v gcloud >/dev/null; then
    echo "❌ gcloud CLI not found"
    echo "💡 Install: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Check authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Not authenticated with Google Cloud"
    echo "💡 Run: gcloud auth login"
    exit 1
fi

# Set project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "🔄 Setting project to: $PROJECT_ID"
    gcloud config set project $PROJECT_ID
fi

# Check service status
echo "📊 Checking service status..."
if gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" --project=$PROJECT_ID 2>/dev/null)
    echo "✅ Service is deployed: $SERVICE_NAME"
    echo "🌐 URL: $SERVICE_URL"
else
    echo "❌ Service not deployed yet"
    echo "💡 Deploy first: ./scripts/deploy-app.sh"
    exit 1
fi

echo ""
echo "Choose an action:"
echo "1. 🔄 Restart service (light - no code changes)"
echo "2. 📊 Scale service (change instance count)"
echo "3. 🛑 Stop service (no traffic)"
echo "4. ▶️  Resume service (restore traffic)"
echo "5. 📋 View service details"
echo "6. 📄 View recent logs"
echo "7. 🧪 Test service health"
echo "8. 🚀 Full redeploy (with code changes)"
echo ""

read -p "Enter your choice (1-8): " choice

case $choice in
    1)
        echo "🔄 Restarting service..."
        gcloud run services update $SERVICE_NAME \
            --set-env-vars=RESTART_TIME=$(date +%s) \
            --region=$REGION \
            --project=$PROJECT_ID
        echo "✅ Service restarted!"
        ;;
    2)
        echo "📊 Current scaling configuration:"
        gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID \
            --format="value(spec.template.metadata.annotations[run.googleapis.com/cpu-throttling],spec.template.spec.containerConcurrency,spec.template.metadata.annotations[autoscaling.knative.dev/minScale],spec.template.metadata.annotations[autoscaling.knative.dev/maxScale])"
        echo ""
        read -p "Enter minimum instances (0-1000, current will be shown above): " min_instances
        read -p "Enter maximum instances (1-1000): " max_instances
        
        if [[ "$min_instances" =~ ^[0-9]+$ ]] && [[ "$max_instances" =~ ^[0-9]+$ ]]; then
            gcloud run services update $SERVICE_NAME \
                --min-instances=$min_instances \
                --max-instances=$max_instances \
                --region=$REGION \
                --project=$PROJECT_ID
            echo "✅ Scaling updated!"
        else
            echo "❌ Invalid input. Please enter numbers only."
        fi
        ;;
    3)
        echo "🛑 Stopping service (removing traffic)..."
        gcloud run services update-traffic $SERVICE_NAME \
            --to-revisions=LATEST=0 \
            --region=$REGION \
            --project=$PROJECT_ID
        echo "✅ Service stopped (no traffic)"
        ;;
    4)
        echo "▶️  Resuming service (restoring traffic)..."
        gcloud run services update-traffic $SERVICE_NAME \
            --to-latest \
            --region=$REGION \
            --project=$PROJECT_ID
        echo "✅ Service resumed (traffic restored)"
        ;;
    5)
        echo "📋 Service details:"
        gcloud run services describe $SERVICE_NAME \
            --region=$REGION \
            --project=$PROJECT_ID
        ;;
    6)
        echo "📄 Recent logs:"
        ./scripts/cloud-logs.sh
        ;;
    7)
        echo "🧪 Testing service health..."
        if [ -n "$SERVICE_URL" ]; then
            echo "Testing: $SERVICE_URL"
            if curl -s -I "$SERVICE_URL" | grep -q "HTTP/[12] 200"; then
                echo "✅ Service is healthy!"
            else
                echo "⚠️  Service may have issues"
                echo "Response:"
                curl -s -I "$SERVICE_URL" | head -5
            fi
        fi
        ;;
    8)
        echo "🚀 Full redeploy with code changes..."
        echo "This will build and deploy new code"
        read -p "Are you sure? (y/N): " confirm
        if [[ $confirm =~ ^[Yy]$ ]]; then
            ./scripts/deploy-app.sh
        else
            echo "Cancelled"
        fi
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "✅ Action completed!"
echo "🌐 Service URL: $SERVICE_URL"