#!/bin/bash

# Check status of Ievolve Event Management System
# Works in local development and cloud environments
# Usage: ./scripts/status.sh

# Detect environment
if [ -n "$GOOGLE_CLOUD_PROJECT" ] || [ -n "$K_SERVICE" ]; then
    ENVIRONMENT="cloud"
elif [ -f "/tmp/cloud_sql_proxy.pid" ] || command -v gcloud >/dev/null; then
    ENVIRONMENT="hybrid"
else
    ENVIRONMENT="local"
fi

echo "📊 Ievolve Event Management System Status ($ENVIRONMENT environment)"
echo "============================================"
echo "Current time: $(date)"
echo ""

# Application Status
echo "🔥 Application Server:"
echo "--------------------------------------------"
APP_PIDS=$(pgrep -f "npm run dev\|tsx server/index.ts\|node server")
if [ -n "$APP_PIDS" ]; then
    echo "✅ RUNNING (PID: $APP_PIDS)"
    
    # Get process details
    echo "📊 Process details:"
    ps -p $APP_PIDS -o pid,ppid,cmd,etime 2>/dev/null || echo "Could not get process details"
    
    # Check if port is listening
    if netstat -ln 2>/dev/null | grep -q ":5000 "; then
        echo "✅ Port 5000 is listening"
    else
        echo "⚠️  Port 5000 is not listening"
    fi
else
    echo "❌ NOT RUNNING"
fi

echo ""

# Database Status
echo "🗄️  Database Connection:"
echo "--------------------------------------------"

# Check Cloud SQL Proxy
PID_FILE="/tmp/cloud_sql_proxy.pid"
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Cloud SQL Proxy RUNNING (PID: $PID)"
        
        # Check if database port is listening
        if netstat -ln 2>/dev/null | grep -q ":5432 "; then
            echo "✅ Database port 5432 is listening"
        else
            echo "⚠️  Database port 5432 is not listening"
        fi
    else
        echo "❌ Cloud SQL Proxy NOT RUNNING (stale PID file)"
    fi
else
    echo "📄 No Cloud SQL Proxy PID file found"
    
    # Check if any cloud_sql_proxy processes are running
    DB_PIDS=$(pgrep -f "cloud_sql_proxy")
    if [ -n "$DB_PIDS" ]; then
        echo "⚠️  Found cloud_sql_proxy processes without PID file: $DB_PIDS"
    else
        echo "ℹ️  Using direct database connection or cloud environment"
    fi
fi

# Test database connectivity
echo ""
echo "🔗 Database Connectivity Test:"
export DATABASE_URL="postgresql://ievolve_user:IevolveSecure2025!@localhost:5432/ievolve_db"

if command -v psql > /dev/null 2>&1; then
    echo "🔄 Testing connection..."
    if timeout 5 psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        echo "✅ Database connection SUCCESSFUL"
    else
        echo "❌ Database connection FAILED"
    fi
else
    echo "ℹ️  psql not available for connection test"
fi

echo ""

# Cloud Service Status (if applicable)
if [ "$ENVIRONMENT" = "hybrid" ] || [ "$ENVIRONMENT" = "cloud" ]; then
    echo "☁️  Cloud Service Status:"
    echo "--------------------------------------------"
    
    if command -v gcloud >/dev/null; then
        PROJECT_ID="ievolve-sports-2025"
        SERVICE_NAME="ievolve-app"
        REGION="asia-south1"
        
        # Check if service exists
        if gcloud run services describe $SERVICE_NAME --region=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
            echo "✅ Cloud service exists: $SERVICE_NAME"
            
            # Get service URL
            SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" --project=$PROJECT_ID 2>/dev/null)
            if [ -n "$SERVICE_URL" ]; then
                echo "🌐 Service URL: $SERVICE_URL"
            fi
        else
            echo "❌ Cloud service not found or not accessible"
        fi
    else
        echo "ℹ️  gcloud CLI not available"
    fi
fi

echo ""
echo "🔧 Quick Actions:"
echo "--------------------------------------------"

if [ -z "$APP_PIDS" ]; then
    echo "▶️  Start app:     npm run dev"
fi

if [ -n "$APP_PIDS" ]; then
    echo "⏹️  Stop app:      ./scripts/stop-app.sh"
fi

if [ ! -f "$PID_FILE" ] && command -v gcloud >/dev/null; then
    echo "🗄️  Start DB:      ./scripts/start-database.sh"
fi

echo "📋 View logs:    ./scripts/view-logs.sh"
echo "🔍 Full check:   ./scripts/check-database.sh"