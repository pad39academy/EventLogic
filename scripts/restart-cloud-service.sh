#!/bin/bash

# Restart Google Cloud Run service without full deployment
# Usage: ./scripts/restart-cloud-service.sh [--no-traffic] [--min-instances N] [--max-instances N]

PROJECT_ID="ievolve-sports-2025"
SERVICE_NAME="ievolve-app" 
REGION="asia-south1"

NO_TRAFFIC=false
MIN_INSTANCES=""
MAX_INSTANCES=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --no-traffic)
            NO_TRAFFIC=true
            shift
            ;;
        --min-instances)
            MIN_INSTANCES="$2"
            shift 2
            ;;
        --max-instances)
            MAX_INSTANCES="$2" 
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --no-traffic        Stop all traffic to service"
            echo "  --min-instances N   Set minimum instances"
            echo "  --max-instances N   Set maximum instances"
            echo "  -h, --help         Show this help"
            echo ""
            echo "Examples:"
            echo "  $0                        # Basic restart"
            echo "  $0 --min-instances 1      # Ensure at least 1 instance"
            echo "  $0 --no-traffic           # Stop service gracefully"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "🔄 Restarting Cloud Run Service (Light Operation)"
echo "=============================================="
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"
echo "Project: $PROJECT_ID"
echo ""

# Check authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ No active Google Cloud authentication found"
    echo "Please run: gcloud auth login"
    exit 1
fi

# Set correct project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "🔄 Setting project to: $PROJECT_ID"
    gcloud config set project $PROJECT_ID
fi

# Check if service exists
if ! gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
    echo "❌ Service $SERVICE_NAME not found"
    echo "💡 Deploy first: ./scripts/deploy-app.sh"
    exit 1
fi

echo "✅ Service found, proceeding with restart..."

if [ "$NO_TRAFFIC" = true ]; then
    echo "🛑 Stopping service by removing traffic..."
    gcloud run services update-traffic $SERVICE_NAME \
        --to-revisions=LATEST=0 \
        --region=$REGION \
        --project=$PROJECT_ID
    echo "✅ Service stopped (no traffic)"
else
    # Build update command
    UPDATE_CMD="gcloud run services update $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
    
    # Add scaling options if provided
    if [ -n "$MIN_INSTANCES" ]; then
        UPDATE_CMD="$UPDATE_CMD --min-instances=$MIN_INSTANCES"
        echo "📊 Setting minimum instances: $MIN_INSTANCES"
    fi
    
    if [ -n "$MAX_INSTANCES" ]; then
        UPDATE_CMD="$UPDATE_CMD --max-instances=$MAX_INSTANCES" 
        echo "📊 Setting maximum instances: $MAX_INSTANCES"
    fi
    
    # Force new revision to restart containers
    UPDATE_CMD="$UPDATE_CMD --set-env-vars=RESTART_TIME=$(date +%s)"
    
    echo "🔄 Updating service to trigger restart..."
    echo "Command: $UPDATE_CMD"
    echo ""
    
    # Execute the update
    eval $UPDATE_CMD
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Service restart completed successfully!"
        
        # Get service URL
        SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" --project=$PROJECT_ID 2>/dev/null)
        
        if [ -n "$SERVICE_URL" ]; then
            echo "🌐 Service URL: $SERVICE_URL"
            echo ""
            echo "🧪 Test the restart:"
            echo "   curl -I $SERVICE_URL"
        fi
        
        echo ""
        echo "📊 View logs:"
        echo "   ./scripts/cloud-logs.sh"
        
    else
        echo ""
        echo "❌ Service restart failed!"
        echo "Check the error messages above"
        exit 1
    fi
fi