#!/bin/bash

# One-time setup for Ievolve Event Management System production secrets
# Usage: ./scripts/one-time-setup.sh

PROJECT_ID="ievolve-sports-2025"
REGION="asia-south1"

echo "🔐 One-Time Production Setup for Ievolve Event Management"
echo "========================================================="
echo ""
echo "This script sets up Google Cloud secrets and permissions that only need to be configured once."
echo ""

# Check authentication
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "❌ Please authenticate with Google Cloud first:"
    echo "   gcloud auth login"
    exit 1
fi

# Set project
echo "🔧 Setting up project: $PROJECT_ID"
gcloud config set project $PROJECT_ID

echo ""
echo "📱 Step 1: Create Twilio Secrets"
echo "--------------------------------"

read -p "Enter your Twilio Account SID: " TWILIO_SID
read -p "Enter your Twilio Auth Token: " TWILIO_TOKEN
read -p "Enter your Twilio Phone Number (e.g., +1234567890): " TWILIO_PHONE

# Create secrets
echo "🔄 Creating Twilio secrets..."

echo "$TWILIO_SID" | gcloud secrets create twilio-account-sid --data-file=- || echo "⚠️  Secret may already exist"
echo "$TWILIO_TOKEN" | gcloud secrets create twilio-auth-token --data-file=- || echo "⚠️  Secret may already exist"  
echo "$TWILIO_PHONE" | gcloud secrets create twilio-phone-number --data-file=- || echo "⚠️  Secret may already exist"

echo "✅ Twilio secrets created"

echo ""
echo "🔐 Step 2: Configure Secret Permissions"
echo "---------------------------------------"

# Get project number
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format="value(projectNumber)")
echo "📊 Project Number: $PROJECT_NUMBER"

# Grant permissions
echo "🔄 Granting Cloud Run service account access to secrets..."

for SECRET in "twilio-account-sid" "twilio-auth-token" "twilio-phone-number"; do
    echo "   Configuring $SECRET..."
    gcloud secrets add-iam-policy-binding $SECRET \
        --role="roles/secretmanager.secretAccessor" \
        --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
        --quiet
done

echo "✅ Secret permissions configured"

echo ""
echo "🎉 One-Time Setup Complete!"
echo "============================"
echo ""
echo "✅ Twilio secrets created in Google Secret Manager"
echo "✅ Cloud Run service account has access to secrets"
echo ""
echo "🚀 Next steps:"
echo "1. Run database setup: npm run db:push"
echo "2. Deploy your app: ./scripts/deploy-app.sh"
echo "3. Test OTP functionality"
echo ""
echo "💡 These secrets are now permanent and don't need to be recreated!"