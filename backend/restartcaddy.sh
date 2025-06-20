#!/bin/bash

echo "🔄 Restart Caddy Server"
echo "======================"
echo ""

echo "📋 Step 1: Check current Caddy status..."
sudo systemctl status caddy --no-pager

echo ""
echo "📋 Step 2: Stop Caddy..."
sudo systemctl stop caddy

echo ""
echo "📋 Step 3: Validate Caddyfile..."
if sudo caddy validate --config /etc/caddy/Caddyfile; then
    echo "✅ Caddyfile validation passed"
else
    echo "❌ Caddyfile validation failed!"
    echo "💡 Check Caddyfile syntax before restarting"
    exit 1
fi

echo ""
echo "📋 Step 4: Start Caddy..."
sudo systemctl start caddy

echo ""
echo "📋 Step 5: Check new status..."
if sudo systemctl is-active --quiet caddy; then
    echo "✅ Caddy restarted successfully"
    sudo systemctl status caddy --no-pager
else
    echo "❌ Caddy failed to start"
    echo "📋 Recent logs:"
    sudo journalctl -u caddy --lines 10 --no-pager
fi

echo ""
echo "📋 Step 6: Test endpoints..."
echo "Testing API..."
if curl -I https://api.tunlify.biz.id/health 2>/dev/null | head -1 | grep -q "200"; then
    echo "✅ API endpoint working"
else
    echo "⚠️  API endpoint issue"
fi

echo ""
echo "Testing tunnel subdomain..."
if curl -I https://testingid.id.tunlify.biz.id 2>/dev/null | head -1; then
    echo "✅ Tunnel subdomain responding"
else
    echo "⚠️  Tunnel subdomain issue"
fi

echo ""
echo "======================"
echo "🎯 Caddy Restart Complete!"
echo ""
echo "📝 Useful Commands:"
echo "   sudo systemctl status caddy"
echo "   sudo journalctl -u caddy -f"
echo "   sudo systemctl reload caddy"
echo ""
echo "🎉 Caddy should now be running with updated configuration!"
