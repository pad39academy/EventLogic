#!/bin/bash

# Stop the Ievolve application server
# Works in local development and cloud environments
# Usage: ./scripts/stop-app.sh [--force]

FORCE_KILL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --force)
            FORCE_KILL=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--force]"
            echo "Options:"
            echo "  --force    Force kill processes immediately"
            echo "  -h, --help Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Detect environment
if [ -n "$GOOGLE_CLOUD_PROJECT" ] || [ -n "$K_SERVICE" ]; then
    ENVIRONMENT="cloud"
    echo "⚠️  Running in cloud environment - cannot stop remote service from here"
    echo "💡 To stop cloud service, use Google Cloud Console or:"
    echo "   gcloud run services delete ievolve-app --region=asia-south1"
    exit 0
else
    ENVIRONMENT="local"
fi

echo "🛑 Stopping Ievolve Application Server (${ENVIRONMENT} environment)..."

# Find and kill the application processes
PIDS=$(pgrep -f "npm run dev\|tsx server/index.ts\|node server")

if [ -n "$PIDS" ]; then
    echo "🔄 Found running application processes: $PIDS"
    echo "🛑 Stopping application..."
    
    if [ "$FORCE_KILL" = true ]; then
        echo "🔨 Force killing processes..."
        kill -9 $PIDS
    else
        # Kill the processes gracefully first
        echo "📤 Sending SIGTERM for graceful shutdown..."
        kill $PIDS
        
        # Wait for graceful shutdown
        sleep 3
        
        # Check if any are still running and force kill if needed
        REMAINING=$(pgrep -f "npm run dev\|tsx server/index.ts\|node server")
        if [ -n "$REMAINING" ]; then
            echo "🔨 Force killing remaining processes..."
            kill -9 $REMAINING
        fi
    fi
    
    echo "✅ Application stopped successfully"
else
    echo "✅ No running application processes found"
fi

echo ""
echo "📊 Verification:"
REMAINING_PIDS=$(pgrep -f "npm run dev\|tsx server/index.ts\|node server")
if [ -n "$REMAINING_PIDS" ]; then
    echo "⚠️  Some processes still running: $REMAINING_PIDS"
    echo "Run with --force flag to force kill"
else
    echo "✅ All application processes stopped"
fi

echo ""
echo "💡 To restart the application:"
echo "   npm run dev"