#!/bin/bash

echo "🔍 Checking Backend Logs for Tunnel Errors"
echo "==========================================="
echo ""

echo "📋 PM2 Status:"
pm2 status

echo ""
echo "📋 Recent Backend Logs (last 50 lines):"
pm2 logs tunlify-backend --lines 50

echo ""
echo "📋 Caddy Status:"
sudo systemctl status caddy --no-pager

echo ""
echo "📋 Recent Caddy Logs:"
sudo journalctl -u caddy --lines 20 --no-pager

echo ""
echo "📋 Caddy Access Logs (if available):"
if [ -f /var/log/caddy/tunlify-api.log ]; then
    echo "API Logs:"
    sudo tail -10 /var/log/caddy/tunlify-api.log
else
    echo "No API logs found"
fi

if [ -f /var/log/caddy/tunlify-tunnels-id.log ]; then
    echo "Tunnel Logs:"
    sudo tail -10 /var/log/caddy/tunlify-tunnels-id.log
else
    echo "No tunnel logs found"
fi

echo ""
echo "📋 System Resources:"
echo "Memory usage:"
free -h
echo "Disk usage:"
df -h /

echo ""
echo "📋 Network Connections:"
echo "Backend port 3001:"
sudo netstat -tlnp | grep :3001

echo ""
echo "🎯 Log Analysis Tips:"
echo "   1. Check PM2 logs for backend errors"
echo "   2. Check Caddy logs for proxy errors"
echo "   3. Look for 'tunnel-proxy' related messages"
echo "   4. Check for WebSocket connection attempts"
