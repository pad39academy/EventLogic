#!/bin/bash

# View logs for the Ievolve application
# Works in local development and Google Cloud environments
# Usage: ./scripts/view-logs.sh [options]
# Options: -f (follow), -n NUMBER (tail lines), --app, --db, --cloud

FOLLOW=false
LINES=50
SHOW_APP=true
SHOW_DB=false
SHOW_CLOUD=false

# Detect environment
if [ -n "$GOOGLE_CLOUD_PROJECT" ] || [ -n "$K_SERVICE" ]; then
    ENVIRONMENT="cloud"
elif [ -f "/tmp/cloud_sql_proxy.pid" ] || command -v gcloud >/dev/null; then
    ENVIRONMENT="hybrid"
else
    ENVIRONMENT="local"
fi

# Auto-enable cloud logs if in cloud environment
if [ "$ENVIRONMENT" = "cloud" ] && [ "$SHOW_APP" = true ] && [ "$SHOW_DB" = false ] && [ "$SHOW_CLOUD" = false ]; then
    SHOW_CLOUD=true
    echo "🔍 Detected cloud environment - enabling cloud logs automatically"
fi

# Parse command line arguments
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
        --app)
            SHOW_APP=true
            SHOW_DB=false
            SHOW_CLOUD=false
            shift
            ;;
        --db)
            SHOW_APP=false
            SHOW_DB=true
            SHOW_CLOUD=false
            shift
            ;;
        --cloud)
            SHOW_APP=false
            SHOW_DB=false
            SHOW_CLOUD=true
            shift
            ;;
        --all)
            SHOW_APP=true
            SHOW_DB=true
            SHOW_CLOUD=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -f, --follow     Follow logs in real-time"
            echo "  -n, --lines N    Show N lines (default: 50)"
            echo "  --app           Show application logs only (default)"
            echo "  --db            Show database logs only"
            echo "  --cloud         Show cloud deployment logs only"
            echo "  --all           Show all available logs"
            echo "  -h, --help      Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "📋 Ievolve Application Logs ($ENVIRONMENT environment)"
echo "============================================"

if [ "$SHOW_APP" = true ]; then
    echo ""
    echo "🔥 Application Logs:"
    echo "--------------------------------------------"
    
    # Check if any app processes are running
    APP_PIDS=$(pgrep -f "npm run dev\|tsx server/index.ts\|node server")
    if [ -n "$APP_PIDS" ]; then
        echo "✅ Application is currently running (PID: $APP_PIDS)"
        
        if [ "$ENVIRONMENT" = "local" ] || [ "$ENVIRONMENT" = "hybrid" ]; then
            echo ""
            echo "📄 Real-time application logs:"
            echo "For local development, logs appear in your development console"
            echo "Use Ctrl+C to stop following logs"
            
            if [ "$FOLLOW" = true ]; then
                echo "Following process logs..."
                # Try to get logs from running process
                tail -f /dev/null &
                TAIL_PID=$!
                echo "Monitoring application process $APP_PIDS..."
                while ps -p $APP_PIDS > /dev/null; do
                    sleep 1
                done
                kill $TAIL_PID 2>/dev/null
            fi
        fi
    else
        echo "❌ Application is not currently running"
        
        if [ "$ENVIRONMENT" = "local" ] || [ "$ENVIRONMENT" = "hybrid" ]; then
            echo ""
            echo "💡 To start the application:"
            echo "   npm run dev"
        fi
    fi
fi

if [ "$SHOW_DB" = true ]; then
    echo ""
    echo "🗄️  Database Logs:"
    echo "--------------------------------------------"
    
    DB_LOG_FILE="/tmp/cloud_sql_proxy.log"
    if [ -f "$DB_LOG_FILE" ]; then
        echo "📄 Database proxy log: $DB_LOG_FILE"
        echo "Last $LINES lines:"
        
        if [ "$FOLLOW" = true ]; then
            echo "Following database logs (Ctrl+C to stop)..."
            tail -f -n "$LINES" "$DB_LOG_FILE"
        else
            tail -n "$LINES" "$DB_LOG_FILE"
        fi
    else
        echo "❌ Local database proxy log not found"
        echo "This is normal if using direct database connection or cloud environment"
    fi
fi

if [ "$SHOW_CLOUD" = true ] && command -v gcloud >/dev/null; then
    echo ""
    echo "☁️  Cloud Deployment Logs:"
    echo "--------------------------------------------"
    
    PROJECT_ID="ievolve-sports-2025"
    SERVICE_NAME="ievolve-app"
    REGION="asia-south1"
    
    echo "📊 Fetching cloud service logs..."
    echo "Project: $PROJECT_ID"
    echo "Service: $SERVICE_NAME"
    echo "Region: $REGION"
    echo ""
    
    # Check if service exists and get logs
    if gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
        echo "✅ Cloud service found: $SERVICE_NAME"
        echo ""
        
        if [ "$FOLLOW" = true ]; then
            echo "📄 Following cloud logs (Ctrl+C to stop)..."
            echo "Running: gcloud run services logs tail $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
            echo ""
            gcloud run services logs tail $SERVICE_NAME --region=$REGION --project=$PROJECT_ID
        else
            echo "📄 Recent cloud logs (last $LINES entries):"
            echo "Running: gcloud run services logs read $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --limit=$LINES"
            echo ""
            gcloud run services logs read $SERVICE_NAME --region=$REGION --project=$PROJECT_ID --limit=$LINES
        fi
    else
        echo "❌ Cloud service not found or not accessible"
        echo ""
        echo "🔍 Troubleshooting:"
        echo "1. Check if service exists:"
        echo "   gcloud run services list --region=$REGION --project=$PROJECT_ID"
        echo ""
        echo "2. Manual log command:"
        echo "   gcloud run services logs read $SERVICE_NAME --region=$REGION --project=$PROJECT_ID"
        echo ""
        echo "3. Deploy service first:"
        echo "   ./scripts/deploy-app.sh"
    fi
fi

echo ""
echo "📊 System Information:"
echo "--------------------------------------------"
echo "Environment: $ENVIRONMENT"
echo "Current time: $(date)"
echo ""
echo "Available log sources:"
if [ "$ENVIRONMENT" = "cloud" ]; then
    echo "  - Cloud Service: Google Cloud Run logs"
    echo "  - Database: Cloud SQL logs via Google Cloud Console"
elif [ "$ENVIRONMENT" = "hybrid" ]; then
    echo "  - Application: Local development server"
    echo "  - Database: Local proxy logs (/tmp/cloud_sql_proxy.log)"
    echo "  - Cloud Service: Google Cloud Run logs (if deployed)"
else
    echo "  - Application: Local development server"
    echo "  - Database: Local database logs"
fi

echo ""
echo "🔧 Common log commands:"
echo "  ./scripts/view-logs.sh --app       # Application logs only"
echo "  ./scripts/view-logs.sh --db        # Database logs only"
echo "  ./scripts/view-logs.sh --cloud     # Cloud deployment logs"
echo "  ./scripts/view-logs.sh --all -f    # Follow all logs"