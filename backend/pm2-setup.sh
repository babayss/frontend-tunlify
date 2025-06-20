#!/bin/bash

# PM2 Setup Script untuk Tunlify Backend
echo "🚀 Setting up PM2 for Tunlify Backend..."

# Install PM2 globally jika belum ada
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
else
    echo "✅ PM2 already installed"
fi

# Create log directory
echo "📁 Creating log directories..."
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# Stop existing process jika ada
echo "🛑 Stopping existing processes..."
pm2 stop tunlify-backend 2>/dev/null || true
pm2 delete tunlify-backend 2>/dev/null || true

# Start dengan ecosystem config
echo "🚀 Starting Tunlify Backend with PM2..."
pm2 start ecosystem.config.js

# Save PM2 configuration
echo "💾 Saving PM2 configuration..."
pm2 save

# Setup PM2 startup (auto-start on boot)
echo "🔄 Setting up PM2 startup..."
pm2 startup

echo ""
echo "✅ PM2 Setup Complete!"
echo ""
echo "📋 Available Commands:"
echo "   npm run pm2:start    - Start backend"
echo "   npm run pm2:restart  - Restart backend"
echo "   npm run pm2:stop     - Stop backend"
echo "   npm run pm2:logs     - View logs"
echo "   npm run pm2:status   - Check status"
echo "   npm run pm2:monit    - Monitor dashboard"
echo ""
echo "🔧 Manual Commands:"
echo "   pm2 restart tunlify-backend --update-env  - Restart with new env"
echo "   pm2 logs tunlify-backend --lines 50       - View last 50 lines"
echo "   pm2 flush tunlify-backend                 - Clear logs"
echo ""
