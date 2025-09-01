#!/bin/bash

# Fix critical production issues for Ievolve Event Management System
# Usage: ./scripts/fix-production-issues.sh

PROJECT_ID="ievolve-sports-2025"
REGION="asia-south1"
SERVICE_NAME="ievolve-app"

echo "🔧 Fixing Critical Production Issues"
echo "===================================="
echo ""

# Step 1: Fix Database Schema
echo "🗄️  Step 1: Creating Database Tables"
echo "-----------------------------------"

# Set database connection for schema push
export DATABASE_URL='postgresql://ievolve_user:IevolveSecure2025!@localhost:5432/ievolve_db'

echo "📋 Current DATABASE_URL: $DATABASE_URL"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Not in project root directory. Please run from ~/Ievolve-mvp1.0"
    exit 1
fi

# Push database schema
echo "🔄 Creating database tables..."
npm run db:push

if [ $? -eq 0 ]; then
    echo "✅ Database schema created successfully"
else
    echo "❌ Database schema creation failed"
    echo "💡 Try running: npm run db:push --force"
    exit 1
fi

echo ""

# Step 2: Configure Twilio Secrets
echo "📱 Step 2: Configuring Twilio Secrets"
echo "-------------------------------------"

# Check if secrets exist
echo "🔍 Checking existing secrets..."
EXISTING_SECRETS=$(gcloud secrets list --format="value(name)" 2>/dev/null)

if echo "$EXISTING_SECRETS" | grep -q "twilio-account-sid"; then
    echo "✅ twilio-account-sid secret exists"
else
    echo "❌ twilio-account-sid secret missing"
    echo "📝 Please create it with: gcloud secrets create twilio-account-sid --data-file=- <<< 'YOUR_ACCOUNT_SID'"
fi

if echo "$EXISTING_SECRETS" | grep -q "twilio-auth-token"; then
    echo "✅ twilio-auth-token secret exists"
else
    echo "❌ twilio-auth-token secret missing"
    echo "📝 Please create it with: gcloud secrets create twilio-auth-token --data-file=- <<< 'YOUR_AUTH_TOKEN'"
fi

if echo "$EXISTING_SECRETS" | grep -q "twilio-phone-number"; then
    echo "✅ twilio-phone-number secret exists"
else
    echo "❌ twilio-phone-number secret missing"
    echo "📝 Please create it with: gcloud secrets create twilio-phone-number --data-file=- <<< 'YOUR_PHONE_NUMBER'"
fi

# Step 3: Grant Secret Access Permissions
echo ""
echo "🔐 Step 3: Configuring Secret Permissions"
echo "-----------------------------------------"

# Get project number for service account
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)" 2>/dev/null)

if [ -n "$PROJECT_NUMBER" ]; then
    echo "📊 Project Number: $PROJECT_NUMBER"
    echo "🔄 Granting secret access permissions..."
    
    # Grant access to secrets
    for SECRET in "twilio-account-sid" "twilio-auth-token" "twilio-phone-number"; do
        if echo "$EXISTING_SECRETS" | grep -q "$SECRET"; then
            echo "🔐 Granting access to $SECRET..."
            gcloud secrets add-iam-policy-binding $SECRET \
                --role="roles/secretmanager.secretAccessor" \
                --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
                --quiet
        fi
    done
    
    echo "✅ Secret permissions configured"
else
    echo "❌ Could not get project number"
fi

echo ""

# Step 4: Redeploy with Secrets
echo "🚀 Step 4: Redeploying with Updated Configuration"
echo "------------------------------------------------"

echo "🔄 Redeploying Cloud Run service with secrets..."

gcloud run deploy $SERVICE_NAME \
    --image="asia-south1-docker.pkg.dev/$PROJECT_ID/ievolve-repo/$SERVICE_NAME:latest" \
    --region=$REGION \
    --allow-unauthenticated \
    --set-env-vars="DATABASE_URL=postgresql://ievolve_user:IevolveSecure2025!@/ievolve_db?host=/cloudsql/${PROJECT_ID}:${REGION}:ievolve-db,NODE_ENV=production" \
    --set-secrets="TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,TWILIO_PHONE_NUMBER=twilio-phone-number:latest" \
    --add-cloudsql-instances="${PROJECT_ID}:${REGION}:ievolve-db" \
    --memory=1Gi \
    --cpu=1 \
    --timeout=300 \
    --project=$PROJECT_ID

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment completed successfully!"
    
    # Get service URL
    SERVICE_URL=$(gcloud run services describe $SERVICE_NAME --region=$REGION --format="value(status.url)" --project=$PROJECT_ID 2>/dev/null)
    
    if [ -n "$SERVICE_URL" ]; then
        echo "🌐 Application URL: $SERVICE_URL"
    fi
    
    echo ""
    echo "🧪 Test the fixes:"
    echo "1. Visit the application URL"
    echo "2. Try admin login to test OTP functionality"
    echo "3. Check logs: gcloud run services logs read $SERVICE_NAME --region=$REGION"
else
    echo "❌ Deployment failed!"
    exit 1
fi