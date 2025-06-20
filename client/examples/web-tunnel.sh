#!/bin/bash

# Web Server Tunnel Example
# This script demonstrates how to create HTTP tunnels using Tunlify

echo "🌐 Web Server Tunnel Setup"
echo "=========================="

# Check if token is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <tunnel-token> [port]"
    echo "Get your token from: https://tunlify.biz.id/dashboard"
    echo ""
    echo "Example: $0 abc123... 3000"
    exit 1
fi

TOKEN=$1
LOCAL_PORT=${2:-3000}

echo "📋 Configuration:"
echo "   Token: ${TOKEN:0:8}..."
echo "   Local Port: $LOCAL_PORT"
echo "   Protocol: HTTP"
echo ""

# Check if web service is running
if ! nc -z localhost $LOCAL_PORT 2>/dev/null; then
    echo "❌ Web service not running on port $LOCAL_PORT"
    echo "💡 Start your web server first, for example:"
    echo "   npm run dev"
    echo "   python -m http.server $LOCAL_PORT"
    echo "   php -S localhost:$LOCAL_PORT"
    exit 1
fi

echo "✅ Web service is running on port $LOCAL_PORT"
echo ""

# Test local service
echo "🧪 Testing local service..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:$LOCAL_PORT | grep -q "200\|301\|302"; then
    echo "✅ Local service responds correctly"
else
    echo "⚠️  Local service might not be responding correctly"
fi
echo ""

# Start tunnel
echo "🚀 Starting web tunnel..."
./tunlify-client -t $TOKEN -l 127.0.0.1:$LOCAL_PORT -p http --verbose