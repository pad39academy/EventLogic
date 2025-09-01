#!/bin/bash

# View logs for the Ievolve application
# Usage: ./scripts/view-logs.sh [options]
# Options: -f (follow), -n NUMBER (tail lines), --app, --db

FOLLOW=false
LINES=50
SHOW_APP=true
SHOW_DB=false

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
            shift
            ;;
        --db)
            SHOW_APP=false
            SHOW_DB=true
            shift
            ;;
        --all)
            SHOW_APP=true
            SHOW_DB=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  -f, --follow     Follow logs in real-time"
            echo "  -n, --lines N    Show N lines (default: 50)"
            echo "  --app           Show application logs only (default)"
            echo "  --db            Show database logs only"
            echo "  --all           Show all logs"
            echo "  -h, --help      Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo "📋 Ievolve Application Logs"
echo "============================================"

if [ "$SHOW_APP" = true ]; then
    echo ""
    echo "🔥 Application Logs (stdout/stderr):"
    echo "--------------------------------------------"
    echo "Note: Application logs appear in the Replit Console workspace"
    echo "For real-time logs, check the Console tab in your workspace"
    
    # Check if any app processes are running
    APP_PIDS=$(pgrep -f "npm run dev\|tsx server/index.ts")
    if [ -n "$APP_PIDS" ]; then
        echo "✅ Application is currently running (PID: $APP_PIDS)"
    else
        echo "❌ Application is not currently running"
    fi
    
    echo ""
    echo "Recent Console Output:"
    echo "To view logs: Go to Console tab → Look for 'Start application' workflow"
fi

if [ "$SHOW_DB" = true ]; then
    echo ""
    echo "🗄️  Database Logs:"
    echo "--------------------------------------------"
    
    DB_LOG_FILE="/tmp/cloud_sql_proxy.log"
    if [ -f "$DB_LOG_FILE" ]; then
        echo "📄 Database log file: $DB_LOG_FILE"
        echo "Last $LINES lines:"
        
        if [ "$FOLLOW" = true ]; then
            echo "Following logs (Ctrl+C to stop)..."
            tail -f -n "$LINES" "$DB_LOG_FILE"
        else
            tail -n "$LINES" "$DB_LOG_FILE"
        fi
    else
        echo "❌ Database log file not found at $DB_LOG_FILE"
        echo "Database proxy may not be running"
    fi
fi

echo ""
echo "📊 System Information:"
echo "--------------------------------------------"
echo "Current time: $(date)"
echo "Available log locations:"
echo "  - Application: Replit Console workspace"
echo "  - Database: /tmp/cloud_sql_proxy.log"

if [ "$FOLLOW" = true ] && [ "$SHOW_APP" = true ] && [ "$SHOW_DB" = false ]; then
    echo ""
    echo "For real-time application logs:"
    echo "1. Open Console tab in Replit workspace"
    echo "2. Look for 'Start application' workflow"
    echo "3. Logs stream automatically there"
fi