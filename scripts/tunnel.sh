#!/bin/bash
# Dev Tunnel Management Script for Allocatrix (Linux/Mac)
# This script sets up and runs a dev tunnel for Schwab OAuth redirect

PORT=3000
TUNNEL_FILE=".devtunnel"

echo "🔧 Allocatrix Dev Tunnel Manager"
echo ""

# Check if devtunnel is installed
if ! command -v devtunnel &> /dev/null; then
    echo "❌ devtunnel CLI not found!"
    echo "Please install it from: https://aka.ms/TunnelsCliDownload"
    exit 1
fi

# Check if user is logged in
if ! devtunnel user show &> /dev/null; then
    echo "🔐 Logging into devtunnel..."
    devtunnel user login
    if [ $? -ne 0 ]; then
        echo "❌ Failed to login to devtunnel"
        exit 1
    fi
    echo "✅ Logged in successfully"
fi

# Check if we have a saved tunnel ID
TUNNEL_ID=""
if [ -f "$TUNNEL_FILE" ]; then
    TUNNEL_ID=$(cat "$TUNNEL_FILE" | tr -d '[:space:]')
    echo "📂 Found saved tunnel ID: $TUNNEL_ID"
    
    # Verify the tunnel still exists
    if ! devtunnel show "$TUNNEL_ID" &> /dev/null; then
        echo "⚠️  Saved tunnel no longer exists, will create a new one"
        TUNNEL_ID=""
        rm -f "$TUNNEL_FILE"
    fi
fi

# Create new tunnel if we don't have one
if [ -z "$TUNNEL_ID" ]; then
    echo "📦 Creating new tunnel..."
    CREATE_OUTPUT=$(devtunnel create --allow-anonymous 2>&1)
    if [ $? -ne 0 ]; then
        echo "❌ Failed to create tunnel"
        echo "$CREATE_OUTPUT"
        exit 1
    fi
    
    TUNNEL_ID=$(echo "$CREATE_OUTPUT" | grep "Tunnel ID" | awk '{print $4}')
    
    # Save tunnel ID for reuse
    echo -n "$TUNNEL_ID" > "$TUNNEL_FILE"
    echo "✅ Tunnel created: $TUNNEL_ID"
    echo "💾 Tunnel ID saved to $TUNNEL_FILE"
    
    # Add port to tunnel
    echo "🔌 Adding port $PORT to tunnel..."
    devtunnel port create -p $PORT
    if [ $? -ne 0 ]; then
        echo "❌ Failed to add port to tunnel"
        exit 1
    fi
    echo "✅ Port $PORT added"
else
    echo "✅ Using existing tunnel: $TUNNEL_ID"
    
    # Check if port is already configured
    if ! devtunnel port show -p $PORT &> /dev/null; then
        echo "🔌 Adding port $PORT to tunnel..."
        devtunnel port create -p $PORT
        if [ $? -ne 0 ]; then
            echo "⚠️  Port might already exist or failed to add"
        else
            echo "✅ Port $PORT added"
        fi
    else
        echo "✅ Port $PORT already configured"
    fi
fi

# Start hosting the tunnel
echo ""
echo "🚀 Starting dev tunnel..."
echo "Press Ctrl+C to stop the tunnel"
echo ""

devtunnel host
