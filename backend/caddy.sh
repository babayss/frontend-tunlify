#!/bin/bash

echo "🔧 Fixing SSL Cipher Issue for Tunnel Subdomains"
echo "================================================"
echo ""

echo "📋 Step 1: Check current SSL certificates..."
echo "Checking certificates for tunnel domains..."

# Check if certificates exist
if [ -d "/var/lib/caddy/.local/share/caddy/certificates" ]; then
    echo "   ✅ Certificate directory exists"
    sudo ls -la /var/lib/caddy/.local/share/caddy/certificates/
else
    echo "   ❌ Certificate directory not found"
fi

echo ""
echo "📋 Step 2: Test SSL handshake..."
echo "Testing SSL connection to tunnel subdomain..."

# Test SSL connection
openssl s_client -connect testingid.id.tunlify.biz.id:443 -servername testingid.id.tunlify.biz.id < /dev/null 2>&1 | head -20

echo ""
echo "📋 Step 3: Create improved Caddyfile with better SSL config..."

# Backup current Caddyfile
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup.$(date +%Y%m%d_%H%M%S)

# Create new Caddyfile with improved SSL configuration
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
{
    # Global options
    admin off
    
    # Enable debug logging for SSL issues
    log {
        level DEBUG
    }
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
    
    # Enhanced TLS configuration
    tls {
        protocols tls1.2 tls1.3
        ciphers TLS_AES_128_GCM_SHA256 TLS_AES_256_GCM_SHA384 TLS_CHACHA20_POLY1305_SHA256 ECDHE-ECDSA-AES128-GCM-SHA256 ECDHE-RSA-AES128-GCM-SHA256 ECDHE-ECDSA-AES256-GCM-SHA384 ECDHE-RSA-AES256-GCM-SHA384 ECDHE-ECDSA-CHACHA20-POLY1305 ECDHE-RSA-CHACHA20-POLY1305
        curves X25519 secp256r1 secp384r1
    }
    
    # Logs
    log {
        output file /var/log/caddy/tunlify-api.log
        format json
    }
}

# Wildcard for tunnel subdomains - Indonesia region
*.id.tunlify.biz.id {
    # Extract subdomain
    @tunnel expression {labels.3} != ""
    
    # Reverse proxy to backend
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
    
    # Enhanced TLS configuration for wildcard
    tls {
        protocols tls1.2 tls1.3
        ciphers TLS_AES_128_GCM_SHA256 TLS_AES_256_GCM_SHA384 TLS_CHACHA20_POLY1305_SHA256 ECDHE-ECDSA-AES128-GCM-SHA256 ECDHE-RSA-AES128-GCM-SHA256 ECDHE-ECDSA-AES256-GCM-SHA384 ECDHE-RSA-AES256-GCM-SHA384 ECDHE-ECDSA-CHACHA20-POLY1305 ECDHE-RSA-CHACHA20-POLY1305
        curves X25519 secp256r1 secp384r1
    }
    
    # Logs
    log {
        output file /var/log/caddy/tunlify-tunnels-id.log
        format json
    }
}

# Other regions with same SSL config
*.sg.tunlify.biz.id {
    @tunnel expression {labels.3} != ""
    
    reverse_proxy @tunnel localhost:3001/tunnel-proxy {
        header_up X-Tunnel-Subdomain {labels.3}
        header_up X-Tunnel-Region "sg"
        header_up X-Real-IP {remote_host}
    }
    
    header {
        X-Powered-By "Tunlify"
        X-Tunnel-Region "sg"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
    }
    
    tls {
        protocols tls1.2 tls1.3
        ciphers TLS_AES_128_GCM_SHA256 TLS_AES_256_GCM_SHA384 TLS_CHACHA20_POLY1305_SHA256 ECDHE-ECDSA-AES128-GCM-SHA256 ECDHE-RSA-AES128-GCM-SHA256 ECDHE-ECDSA-AES256-GCM-SHA384 ECDHE-RSA-AES256-GCM-SHA384 ECDHE-ECDSA-CHACHA20-POLY1305 ECDHE-RSA-CHACHA20-POLY1305
        curves X25519 secp256r1 secp384r1
    }
    
    log {
        output file /var/log/caddy/tunlify-tunnels-sg.log
        format json
    }
}

*.us.tunlify.biz.id {
    @tunnel expression {labels.3} != ""
    
    reverse_proxy @tunnel localhost:3001/tunnel-proxy {
        header_up X-Tunnel-Subdomain {labels.3}
        header_up X-Tunnel-Region "us"
        header_up X-Real-IP {remote_host}
    }
    
    header {
        X-Powered-By "Tunlify"
        X-Tunnel-Region "us"
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        X-Content-Type-Options "nosniff"
    }
    
    tls {
        protocols tls1.2 tls1.3
        ciphers TLS_AES_128_GCM_SHA256 TLS_AES_256_GCM_SHA384 TLS_CHACHA20_POLY1305_SHA256 ECDHE-ECDSA-AES128-GCM-SHA256 ECDHE-RSA-AES128-GCM-SHA256 ECDHE-ECDSA-AES256-GCM-SHA384 ECDHE-RSA-AES256-GCM-SHA384 ECDHE-ECDSA-CHACHA20-POLY1305 ECDHE-RSA-CHACHA20-POLY1305
        curves X25519 secp256r1 secp384r1
    }
    
    log {
        output file /var/log/caddy/tunlify-tunnels-us.log
        format json
    }
}
EOF

echo "   ✅ New Caddyfile created with enhanced SSL configuration"

echo ""
echo "📋 Step 4: Validate new Caddyfile..."
if sudo caddy validate --config /etc/caddy/Caddyfile; then
    echo "   ✅ Caddyfile validation successful"
else
    echo "   ❌ Caddyfile validation failed - restoring backup"
    sudo cp /etc/caddy/Caddyfile.backup.* /etc/caddy/Caddyfile
    exit 1
fi

echo ""
echo "📋 Step 5: Clear SSL certificates cache..."
echo "Stopping Caddy to clear SSL cache..."
sudo systemctl stop caddy

echo "Clearing certificate cache..."
sudo rm -rf /var/lib/caddy/.local/share/caddy/certificates/acme*
sudo rm -rf /var/lib/caddy/.local/share/caddy/certificates/local*

echo ""
echo "📋 Step 6: Restart Caddy with new SSL configuration..."
sudo systemctl start caddy

# Wait for startup
sleep 5

echo ""
echo "📋 Step 7: Check Caddy status..."
sudo systemctl status caddy --no-pager

echo ""
echo "📋 Step 8: Test SSL connection..."
echo "Waiting for SSL certificates to be generated..."
sleep 10

echo "Testing SSL handshake..."
timeout 10 openssl s_client -connect testingid.id.tunlify.biz.id:443 -servername testingid.id.tunlify.biz.id < /dev/null

echo ""
echo "================================================"
echo "🎯 SSL Fix Summary:"
echo "   🔧 Enhanced TLS configuration with modern ciphers"
echo "   🔧 Explicit protocol support (TLS 1.2 and 1.3)"
echo "   🔧 Cleared certificate cache"
echo "   🔧 Restarted Caddy with new config"
echo ""
echo "💡 Next Steps:"
echo "   1. Wait 2-3 minutes for certificates to generate"
echo "   2. Test: curl -I https://testingid.id.tunlify.biz.id/"
echo "   3. Check logs: sudo journalctl -u caddy -f"
echo ""
echo "🚀 If still having issues:"
echo "   - Check DNS propagation"
echo "   - Verify firewall allows port 443"
echo "   - Check Cloudflare SSL settings"
