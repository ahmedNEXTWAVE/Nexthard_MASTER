#!/bin/bash

# --- Cleanup Function ---
# Called when a termination signal (like Ctrl+C) is received
cleanup() {
    echo ""
    echo "Termination signal received. Stopping background processes..."
    
    # Stop the first process (CashDevice-RestAPI) if it exists
    if [ ! -z "$PID_CASH" ] && kill -0 $PID_CASH 2>/dev/null; then
        echo "Stopping CashDevice-RestAPI (PID: $PID_CASH)..."
        kill -TERM $PID_CASH 2>/dev/null
        sleep 1
        
        # Force kill if still running
        if kill -0 $PID_CASH 2>/dev/null; then
            echo "Process $PID_CASH still active. Forcing shutdown (SIGKILL)."
            kill -KILL $PID_CASH 2>/dev/null
        fi
    fi
    
    # Stop the second process (nexthard-server) if it exists
    if [ ! -z "$PID_NODE" ] && kill -0 $PID_NODE 2>/dev/null; then
        echo "Stopping NEXTHARD-COIN server (PID: $PID_NODE)..."
        kill -TERM $PID_NODE 2>/dev/null
        sleep 1
        
        # Force kill if still running
        if kill -0 $PID_NODE 2>/dev/null; then
            echo "Process $PID_NODE still active. Forcing shutdown (SIGKILL)."
            kill -KILL $PID_NODE 2>/dev/null
        fi
    fi
    
    echo "All background processes stopped. Exiting script."
    exit 0
}

# Set trap to call cleanup on SIGINT (Ctrl+C) or SIGTERM
trap cleanup INT TERM

# 1. Start CashDevice-RestAPI in background
echo "Starting ITL REST API server in background..."
cd "./NET_8.0/" || { echo "Error: Directory ./NET_8.0/ not found. Aborting."; exit 1; }
dotnet CashDevice-RestAPI.dll > /dev/null 2>&1 &
PID_CASH=$!
echo "CashDevice-RestAPI started (PID: $PID_CASH)"

# 2. Wait 1 second
sleep 1

# 3. Start nexthard-server.js
echo "Starting NEXTHARD-COIN server in background..."
cd "../" || { echo "Error: Cannot return to parent directory. Aborting."; cleanup; }
node nexthard-server.js >> nexthard-server.log 2>&1 &
PID_NODE=$!
echo "NEXTHARD-COIN server started (PID: $PID_NODE)"

# Wait for both background processes
wait
