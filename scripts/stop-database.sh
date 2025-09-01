#!/bin/bash

# Stop Cloud SQL Proxy
# Usage: ./scripts/stop-database.sh

PID_FILE="/tmp/cloud_sql_proxy.pid"
LOG_FILE="/tmp/cloud_sql_proxy.log"

echo "🛑 Stopping Cloud SQL Proxy..."

if [ ! -f "$PID_FILE" ]; then
    echo "❌ PID file not found. Proxy may not be running."
    echo "🔍 Checking for any running cloud_sql_proxy processes..."
    
    # Look for any cloud_sql_proxy processes
    PIDS=$(pgrep -f "cloud_sql_proxy")
    if [ -n "$PIDS" ]; then
        echo "🔄 Found running cloud_sql_proxy processes: $PIDS"
        echo "🛑 Killing all cloud_sql_proxy processes..."
        pkill -f "cloud_sql_proxy"
        echo "✅ All cloud_sql_proxy processes terminated"
    else
        echo "✅ No cloud_sql_proxy processes found"
    fi
    exit 0
fi

PID=$(cat "$PID_FILE")

if ps -p "$PID" > /dev/null 2>&1; then
    echo "🔄 Terminating Cloud SQL Proxy (PID: $PID)..."
    kill "$PID"
    
    # Wait for process to terminate
    sleep 2
    
    # Force kill if still running
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "🔨 Force killing Cloud SQL Proxy..."
        kill -9 "$PID"
    fi
    
    echo "✅ Cloud SQL Proxy stopped successfully"
else
    echo "⚠️  Process $PID not found (may have already stopped)"
fi

# Clean up files
rm -f "$PID_FILE"
echo "🧹 Cleaned up PID file"

if [ -f "$LOG_FILE" ]; then
    echo "📋 Log file preserved at: $LOG_FILE"
fi