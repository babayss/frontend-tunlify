#!/bin/bash

# SSH Tunnel Example
# This script demonstrates how to create an SSH tunnel using Tunlify

echo "🔐 SSH Tunnel Setup"
echo "==================="

# Check if token is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <tunnel-token>"
    echo "Get your token from: https://tunlify.biz.id/dashboard"
    exit 1
fi

TOKEN=$1
LOCAL_SSH_PORT=${2:-22}

echo "📋 Configuration:"
echo "   Token: ${TOKEN:0:8}..."
echo "   Local SSH Port: $LOCAL_SSH_PORT"
echo "   Protocol: TCP"
echo ""

# Check if SSH service is running
if ! nc -z localhost $LOCAL_SSH_PORT 2>/dev/null; then
    echo "❌ SSH service not running on port $LOCAL_SSH_PORT"
    echo "💡 Start SSH service with: sudo systemctl start ssh"
    exit 1
fi

echo "✅ SSH service is running on port $LOCAL_SSH_PORT"
echo ""

# Start tunnel
echo "🚀 Starting SSH tunnel..."
./tunlify-client -t $TOKEN -l 127.0.0.1:$LOCAL_SSH_PORT -p tcp --verbose