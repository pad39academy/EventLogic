#!/bin/bash

# Check Cloud SQL Proxy status and database connectivity
# Usage: ./scripts/check-database.sh

PID_FILE="/tmp/cloud_sql_proxy.pid"
LOG_FILE="/tmp/cloud_sql_proxy.log"
PORT="5432"

echo "🔍 Checking Cloud SQL Proxy Status..."
echo "============================================"

# Check if PID file exists
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    echo "📄 PID file found: $PID"
    
    # Check if process is running
    if ps -p "$PID" > /dev/null 2>&1; then
        echo "✅ Cloud SQL Proxy is RUNNING (PID: $PID)"
        
        # Get process details
        echo "📊 Process details:"
        ps -p "$PID" -o pid,ppid,cmd,etime
        
    else
        echo "❌ Process $PID not found (proxy may have crashed)"
        echo "🧹 Removing stale PID file..."
        rm -f "$PID_FILE"
    fi
else
    echo "📄 No PID file found"
    
    # Check for any running cloud_sql_proxy processes
    PIDS=$(pgrep -f "cloud_sql_proxy")
    if [ -n "$PIDS" ]; then
        echo "⚠️  Found running cloud_sql_proxy processes without PID file:"
        ps -p $PIDS -o pid,ppid,cmd,etime
    else
        echo "❌ Cloud SQL Proxy is NOT RUNNING"
    fi
fi

echo ""
echo "🌐 Network Status:"
echo "============================================"

# Check if port is listening
if netstat -ln 2>/dev/null | grep -q ":$PORT "; then
    echo "✅ Port $PORT is listening"
else
    echo "❌ Port $PORT is not listening"
fi

echo ""
echo "🔗 Database Connectivity Test:"
echo "============================================"

# Test database connection
export DATABASE_URL="postgresql://ievolve_user:IevolveSecure2025!@localhost:$PORT/ievolve_db"

if command -v psql > /dev/null 2>&1; then
    echo "🔄 Testing connection with psql..."
    if timeout 5 psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
        echo "✅ Database connection SUCCESSFUL"
        
        # Get database info
        echo "📊 Database info:"
        psql "$DATABASE_URL" -c "SELECT version();" 2>/dev/null | head -3
        echo ""
        psql "$DATABASE_URL" -c "SELECT current_database(), current_user;" 2>/dev/null
        
    else
        echo "❌ Database connection FAILED"
    fi
else
    echo "⚠️  psql not available for connection test"
fi

echo ""
echo "📋 Log Information:"
echo "============================================"

if [ -f "$LOG_FILE" ]; then
    echo "📄 Log file: $LOG_FILE"
    echo "📊 Last 5 log entries:"
    tail -5 "$LOG_FILE" 2>/dev/null || echo "Could not read log file"
else
    echo "📄 No log file found"
fi

echo ""
echo "🛠️  Quick Commands:"
echo "============================================"
echo "▶️  Start:  ./scripts/start-database.sh"
echo "⏹️  Stop:   ./scripts/stop-database.sh"
echo "🔍 Check:  ./scripts/check-database.sh"