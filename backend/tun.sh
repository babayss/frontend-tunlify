#!/bin/bash

echo "🔧 Fixing Tunnel Proxy Configuration"
echo "===================================="
echo ""

echo "📋 Step 1: Stop Caddy service..."
sudo systemctl stop caddy

echo ""
echo "📋 Step 2: Backup current Caddyfile..."
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup.$(date +%Y%m%d_%H%M%S)

echo ""
echo "📋 Step 3: Create corrected Caddyfile..."
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
{
    # Global options
    admin off
}

# Backend API
api.tunlify.biz.id {
    reverse_proxy localhost:3001
    
    # Security headers
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
        X-Frame-Options "DENY"
        X-XSS-Protection "1; mode=block"
    }
    
    # SSL with Cloudflare DNS
    tls {
        dns cloudflare {
            api_token 57CLHvTwjLFNevw2JcSB1JNxM4jv5B3Z_A3QM5aM
        }
    }
    
    # Logs
    log {
        output file /var/log/caddy/tunlify-api.log
        format json
    }
}

# Wildcard for tunnel subdomains - Indonesia region
*.id.tunlify.biz.id {
    # Extract subdomain (example: myapp.id.tunlify.biz.id -> myapp)
    @tunnel expression {labels.3} != ""
    
    # Reverse proxy to backend tunnel-proxy endpoint
    reverse_proxy @tunnel localhost:3001/tunnel-proxy {
        header_up X-Tunnel-Subdomain {labels.3}
        header_up X-Tunnel-Region "id"
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
    
    # Security headers
    header {
        X-Powered-By "Tunlify"
        X-Tunnel-Region "id"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
    }
    
    # SSL with Cloudflare DNS
    tls {
        dns cloudflare {
            api_token 57CLHvTwjLFNevw2JcSB1JNxM4jv5B3Z_A3QM5aM
        }
    }
    
    # Logs
    log {
        output file /var/log/caddy/tunlify-tunnels-id.log
        format json
    }
}

# Singapore region
*.sg.tunlify.biz.id {
    @tunnel expression {labels.3} != ""
    
    reverse_proxy @tunnel localhost:3001/tunnel-proxy {
        header_up X-Tunnel-Subdomain {labels.3}
        header_up X-Tunnel-Region "sg"
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
    
    header {
        X-Powered-By "Tunlify"
        X-Tunnel-Region "sg"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
    }
    
    tls {
        dns cloudflare {
            api_token 57CLHvTwjLFNevw2JcSB1JNxM4jv5B3Z_A3QM5aM
        }
    }
    
    log {
        output file /var/log/caddy/tunlify-tunnels-sg.log
        format json
    }
}

# US region
*.us.tunlify.biz.id {
    @tunnel expression {labels.3} != ""
    
    reverse_proxy @tunnel localhost:3001/tunnel-proxy {
        header_up X-Tunnel-Subdomain {labels.3}
        header_up X-Tunnel-Region "us"
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Forwarded-Host {host}
    }
    
    header {
        X-Powered-By "Tunlify"
        X-Tunnel-Region "us"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
    }
    
    tls {
        dns cloudflare {
            api_token 57CLHvTwjLFNevw2JcSB1JNxM4jv5B3Z_A3QM5aM
        }
    }
    
    log {
        output file /var/log/caddy/tunlify-tunnels-us.log
        format json
    }
}
EOF

echo "   ✅ Corrected Caddyfile created"

echo ""
echo "📋 Step 4: Validate new Caddyfile..."
if sudo caddy validate --config /etc/caddy/Caddyfile; then
    echo "   ✅ Caddyfile validation successful"
    
    echo ""
    echo "📋 Step 5: Start Caddy service..."
    sudo systemctl start caddy
    
    echo ""
    echo "📋 Step 6: Check Caddy status..."
    sudo systemctl status caddy --no-pager
    
    echo ""
    echo "✅ Tunnel proxy configuration fixed!"
    echo ""
    echo "🎯 Key fixes applied:"
    echo "   - Fixed reverse_proxy path to localhost:3001/tunnel-proxy"
    echo "   - Removed problematic cipher specifications"
    echo "   - Simplified SSL configuration"
    echo "   - Added proper header forwarding"
    echo ""
    echo "🧪 Test your tunnel now:"
    echo "   curl -I https://testingid.id.tunlify.biz.id/"
    echo ""
    echo "📋 Expected result:"
    echo "   - Should get HTTP response (not DNS error)"
    echo "   - May get 404 or 503 if tunnel not active (that's normal)"
    echo "   - No more 'lookup tunnel-proxy' errors"
    
else
    echo "   ❌ Caddyfile validation failed"
    echo "   Restoring backup..."
    sudo cp /etc/caddy/Caddyfile.backup.* /etc/caddy/Caddyfile 2>/dev/null || true
    sudo systemctl start caddy
fi
