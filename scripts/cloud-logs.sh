#!/bin/bash

# Direct Google Cloud Run logs access for Ievolve Event Management System
# Usage: ./scripts/cloud-logs.sh [--follow] [--lines NUMBER]

PROJECT_ID="ievolve-sports-2025"
SERVICE_NAME="ievolve-app"
REGION="asia-south1"

FOLLOW=false
LINES=50

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow)
            FOLLOW=true
            shift
            ;;
        -n|--lines)
            LINES="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -f, --follow     Follow logs in real-time"
            echo "  -n, --lines N    Show N lines (default: 50)"
            echo "  -h, --help      Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "☁️  Ievolve Cloud Service Logs"
echo "============================================"
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"  
echo "Region: $REGION"
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

echo "📊 Fetching logs..."

if [ "$FOLLOW" = true ]; then
    echo "📄 Following real-time logs (Ctrl+C to stop)..."
    echo ""
    gcloud run services logs tail $SERVICE_NAME --region=$REGION --project=$PROJECT_ID
else
    echo "📄 Recent logs (last $LINES entries):"
    echo ""
    gcloud run services logs read $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --limit=$LINES
fi