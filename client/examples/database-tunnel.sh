#!/bin/bash

# Database Tunnel Example
# This script demonstrates how to create database tunnels using Tunlify

echo "🗄️  Database Tunnel Setup"
echo "========================="

# Check if token is provided
if [ -z "$1" ] || [ -z "$2" ]; then
    echo "Usage: $0 <tunnel-token> <database-type> [port]"
    echo ""
    echo "Supported database types:"
    echo "  mysql      (default port: 3306)"
    echo "  postgresql (default port: 5432)"
    echo "  mongodb    (default port: 27017)"
    echo "  redis      (default port: 6379)"
    echo ""
    echo "Example: $0 abc123... mysql 3306"
    exit 1
fi

TOKEN=$1
DB_TYPE=$2

# Set default ports based on database type
case $DB_TYPE in
    mysql)
        DEFAULT_PORT=3306
        ;;
    postgresql|postgres)
        DEFAULT_PORT=5432
        ;;
    mongodb|mongo)
        DEFAULT_PORT=27017
        ;;
    redis)
        DEFAULT_PORT=6379
        ;;
    *)
        echo "❌ Unsupported database type: $DB_TYPE"
        exit 1
        ;;
esac

LOCAL_PORT=${3:-$DEFAULT_PORT}

echo "📋 Configuration:"
echo "   Token: ${TOKEN:0:8}..."
echo "   Database: $DB_TYPE"
echo "   Local Port: $LOCAL_PORT"
echo "   Protocol: TCP"
echo ""

# Check if database service is running
if ! nc -z localhost $LOCAL_PORT 2>/dev/null; then
    echo "❌ $DB_TYPE service not running on port $LOCAL_PORT"
    echo "💡 Make sure your $DB_TYPE server is running and listening on port $LOCAL_PORT"
    exit 1
fi

echo "✅ $DB_TYPE service is running on port $LOCAL_PORT"
echo ""

# Start tunnel
echo "🚀 Starting $DB_TYPE tunnel..."
./tunlify-client -t $TOKEN -l 127.0.0.1:$LOCAL_PORT -p tcp --verbose