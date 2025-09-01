#!/bin/bash

# Start Cloud SQL Proxy in background
# Usage: ./scripts/start-database.sh

INSTANCE_CONNECTION_NAME="ievolve-sports-2025:asia-south1:ievolve-db"
PORT="5432"
PID_FILE="/tmp/cloud_sql_proxy.pid"
LOG_FILE="/tmp/cloud_sql_proxy.log"

echo "🔄 Starting Cloud SQL Proxy for $INSTANCE_CONNECTION_NAME..."

# Check if proxy is already running
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "❌ Cloud SQL Proxy is already running (PID: $PID)"
        echo "   Use './scripts/stop-database.sh' to stop it first"
        exit 1
    else
        echo "🧹 Removing stale PID file..."
        rm -f "$PID_FILE"
    fi
fi

# Start proxy in background with nohup
nohup ./cloud_sql_proxy -instances="$INSTANCE_CONNECTION_NAME=tcp:$PORT" > "$LOG_FILE" 2>&1 &
PROXY_PID=$!

# Save PID to file
echo $PROXY_PID > "$PID_FILE"

# Wait a moment and check if it started successfully
sleep 2
if ps -p "$PROXY_PID" > /dev/null 2>&1; then
    echo "✅ Cloud SQL Proxy started successfully!"
    echo "   PID: $PROXY_PID"
    echo "   Port: $PORT"
    echo "   Log file: $LOG_FILE"
    echo "   PID file: $PID_FILE"
    echo ""
    echo "📝 Database connection string:"
    echo "   postgresql://ievolve_user:IevolveSecure2025!@localhost:$PORT/ievolve_db"
    echo ""
    echo "🔍 Use './scripts/check-database.sh' to check status"
    echo "🛑 Use './scripts/stop-database.sh' to stop"
else
    echo "❌ Failed to start Cloud SQL Proxy"
    echo "📋 Check log file: $LOG_FILE"
    rm -f "$PID_FILE"
    exit 1
fi