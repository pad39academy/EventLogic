#!/bin/bash

# Stop the Ievolve application server
# Usage: ./scripts/stop-app.sh

echo "🛑 Stopping Ievolve Application Server..."

# Find and kill the npm/tsx processes
PIDS=$(pgrep -f "npm run dev\|tsx server/index.ts")

if [ -n "$PIDS" ]; then
    echo "🔄 Found running application processes: $PIDS"
    echo "🛑 Stopping application..."
    
    # Kill the processes gracefully
    kill $PIDS
    
    # Wait a moment for graceful shutdown
    sleep 3
    
    # Check if any are still running and force kill if needed
    REMAINING=$(pgrep -f "npm run dev\|tsx server/index.ts")
    if [ -n "$REMAINING" ]; then
        echo "🔨 Force killing remaining processes..."
        kill -9 $REMAINING
    fi
    
    echo "✅ Application stopped successfully"
else
    echo "✅ No running application processes found"
fi

echo "📊 Current process status:"
ps aux | grep -E "(npm|tsx)" | grep -v grep || echo "No npm/tsx processes running"