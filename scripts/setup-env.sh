#!/bin/bash

# Setup environment variables for Ievolve Event Management System
# Usage: source ./scripts/setup-env.sh

echo "🔧 Setting up Ievolve Environment Variables"
echo "==========================================="

# Check if .env file exists
if [ -f ".env" ]; then
    echo "📁 Loading environment from .env file..."
    export $(cat .env | grep -v '^#' | xargs)
    echo "✅ Environment variables loaded from .env"
else
    echo "📁 No .env file found, setting up basic environment..."
    
    # Set basic database URL for local development
    export DATABASE_URL='postgresql://ievolve_user:IevolveSecure2025!@localhost:5432/ievolve_db'
    export NODE_ENV='development'
    
    echo "✅ Basic environment variables set"
    echo ""
    echo "💡 To create a permanent .env file:"
    echo "   cp .env.local .env"
    echo "   # Then edit .env with your actual Twilio credentials"
fi

echo ""
echo "📋 Current Environment:"
echo "   DATABASE_URL: $DATABASE_URL"
echo "   NODE_ENV: $NODE_ENV"

if [ -n "$TWILIO_ACCOUNT_SID" ]; then
    echo "   TWILIO_ACCOUNT_SID: ${TWILIO_ACCOUNT_SID:0:10}..." 
else
    echo "   TWILIO_ACCOUNT_SID: (not set)"
fi

if [ -n "$TWILIO_AUTH_TOKEN" ]; then
    echo "   TWILIO_AUTH_TOKEN: ${TWILIO_AUTH_TOKEN:0:10}..."
else
    echo "   TWILIO_AUTH_TOKEN: (not set)"
fi

if [ -n "$TWILIO_PHONE_NUMBER" ]; then
    echo "   TWILIO_PHONE_NUMBER: $TWILIO_PHONE_NUMBER"
else
    echo "   TWILIO_PHONE_NUMBER: (not set)"
fi

echo ""
echo "🚀 Ready to run commands with proper environment!"
echo ""
echo "📌 Usage examples:"
echo "   npm run db:push          # Uses DATABASE_URL automatically"
echo "   npm run dev              # Starts with all environment variables"
echo "   node scripts/create-admin-postgres.js  # Creates admin with DB connection"