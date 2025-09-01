#!/bin/bash

# Deployment script for Ievolve Event Management System to Google Cloud
set -e

PROJECT_ID="ievolve-sports-2025"
REGION="asia-south1"
DB_INSTANCE="ievolve-db"
DB_NAME="ievolve_db"
DB_USER="ievolve_user"
DB_PASSWORD="IevolveSecure2025!"

echo "🚀 Starting deployment to Google Cloud..."

# Set the project
gcloud config set project $PROJECT_ID

# Check if billing is enabled
echo "💳 Checking billing status..."
BILLING_ACCOUNT=$(gcloud billing projects describe $PROJECT_ID --format="value(billingAccountName)" 2>/dev/null || echo "")

if [ -z "$BILLING_ACCOUNT" ]; then
    echo "❌ ERROR: Billing is not enabled for this project!"
    echo ""
    echo "Please enable billing before running this script:"
    echo "1. Visit: https://console.cloud.google.com/billing"
    echo "2. Select your project: $PROJECT_ID"
    echo "3. Link a billing account"
    echo "4. Re-run this script"
    echo ""
    exit 1
fi

echo "✅ Billing is enabled for project $PROJECT_ID"

# Enable required APIs
echo "📋 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable artifactregistry.googleapis.com

# Create Artifact Registry repository (if it doesn't exist)
echo "🖼️ Setting up Artifact Registry repository..."
if ! gcloud artifacts repositories describe ievolve-repo --location=$REGION --quiet 2>/dev/null;
then
    gcloud artifacts repositories create ievolve-repo \
      --repository-format=docker \
      --location=$REGION \
      --description="Docker repository for ievolve-app"
fi

# Configure Docker authentication for Artifact Registry
echo "🔐 Configuring Docker authentication..."
gcloud auth configure-docker $REGION-docker.pkg.dev

# Create Cloud SQL instance (if it doesn't exist)
echo "🗄️ Setting up Cloud SQL PostgreSQL instance..."
if ! gcloud sql instances describe $DB_INSTANCE --quiet 2>/dev/null;
then
    gcloud sql instances create $DB_INSTANCE \
        --database-version=POSTGRES_15 \
        --tier=db-f1-micro \
        --region=$REGION \
        --storage-type=SSD \
        --storage-size=10GB \
        --backup-start-time=03:00
fi

# Create database
echo "📊 Creating database..."
if gcloud sql databases describe $DB_NAME --instance=$DB_INSTANCE --quiet 2>/dev/null; then
    echo "Database $DB_NAME already exists"
else
    gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE --quiet
    echo "Database $DB_NAME created successfully"
fi

# Create database user
echo "👤 Creating database user..."
gcloud sql users create $DB_USER \
    --instance=$DB_INSTANCE \
    --password=$DB_PASSWORD \
    --quiet || echo "User already exists"

# Create secrets
echo "🔐 Creating secrets..."
if gcloud secrets describe db-password --quiet 2>/dev/null; then
    echo "Secret db-password already exists"
else
    echo "$DB_PASSWORD" | gcloud secrets create db-password --data-file=- --quiet
    echo "Secret db-password created"
fi

if gcloud secrets describe database-url --quiet 2>/dev/null; then
    echo "Secret database-url already exists"
else
    echo "postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$PROJECT_ID:$REGION:$DB_INSTANCE" | gcloud secrets create database-url --data-file=- --quiet
    echo "Secret database-url created"
fi

# You'll need to update these with your actual Twilio credentials
echo "Please update the following secrets with your actual Twilio credentials:"
echo "gcloud secrets create twilio-account-sid --data-file=- <<< 'your_twilio_account_sid'"
echo "gcloud secrets create twilio-auth-token --data-file=- <<< 'your_twilio_auth_token'"
echo "gcloud secrets create twilio-phone-number --data-file=- <<< 'your_twilio_phone_number'"

# Build and deploy the application
echo "🏗️ Building and deploying the application..."
gcloud builds submit --no-cache --tag asia-south1-docker.pkg.dev/$PROJECT_ID/ievolve-repo/ievolve-app --project=$PROJECT_ID

# Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
gcloud run deploy ievolve-app \
    --image asia-south1-docker.pkg.dev/$PROJECT_ID/ievolve-repo/ievolve-app \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production \
    --add-cloudsql-instances $PROJECT_ID:$REGION:$DB_INSTANCE \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --timeout 300s \
    --set-secrets=DATABASE_URL=database-url:latest

# Get the service URL
SERVICE_URL=$(gcloud run services describe ievolve-app --region=$REGION --format="value(status.url)")

echo "✅ Deployment complete!"
echo "🌐 Application URL: $SERVICE_URL"
echo "🗄️ Database: $PROJECT_ID:$REGION:$DB_INSTANCE"
echo ""
echo "Next steps:"
echo "1. Update Twilio secrets with your actual credentials"
echo "2. Run database migrations if needed"
echo "3. Test the application at: $SERVICE_URL"

