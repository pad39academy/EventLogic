#!/bin/bash

# Deployment script for Ievolve Event Management System to Google Cloud
set -e

PROJECT_ID="ievolve-event-management"
REGION="asia-south1"
DB_INSTANCE="ievolve-postgres"
DB_NAME="ievolve_db"
DB_USER="ievolve_user"
DB_PASSWORD="IevolveSecure2025!"

echo "🚀 Starting deployment to Google Cloud..."

# Set the project
gcloud config set project $PROJECT_ID

# Enable required APIs
echo "📋 Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
gcloud services enable containerregistry.googleapis.com

# Create Cloud SQL instance (if it doesn't exist)
echo "🗄️ Setting up Cloud SQL PostgreSQL instance..."
if ! gcloud sql instances describe $DB_INSTANCE --quiet 2>/dev/null; then
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
gcloud sql databases create $DB_NAME --instance=$DB_INSTANCE --quiet || echo "Database already exists"

# Create database user
echo "👤 Creating database user..."
gcloud sql users create $DB_USER \
    --instance=$DB_INSTANCE \
    --password=$DB_PASSWORD \
    --quiet || echo "User already exists"

# Create secrets
echo "🔐 Creating secrets..."
echo "$DB_PASSWORD" | gcloud secrets create db-password --data-file=- --quiet || echo "Secret already exists"
echo "postgresql://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$PROJECT_ID:$REGION:$DB_INSTANCE" | gcloud secrets create database-url --data-file=- --quiet || echo "Secret already exists"

# You'll need to update these with your actual Twilio credentials
echo "Please update the following secrets with your actual Twilio credentials:"
echo "gcloud secrets create twilio-account-sid --data-file=- <<< 'your_twilio_account_sid'"
echo "gcloud secrets create twilio-auth-token --data-file=- <<< 'your_twilio_auth_token'"
echo "gcloud secrets create twilio-phone-number --data-file=- <<< 'your_twilio_phone_number'"

# Build and deploy the application
echo "🏗️ Building and deploying the application..."
gcloud builds submit --tag gcr.io/$PROJECT_ID/ievolve-app

# Deploy to Cloud Run
echo "☁️ Deploying to Cloud Run..."
gcloud run deploy ievolve-app \
    --image gcr.io/$PROJECT_ID/ievolve-app \
    --platform managed \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production \
    --set-secrets DATABASE_URL=database-url:latest \
    --set-secrets TWILIO_ACCOUNT_SID=twilio-account-sid:latest \
    --set-secrets TWILIO_AUTH_TOKEN=twilio-auth-token:latest \
    --set-secrets TWILIO_PHONE_NUMBER=twilio-phone-number:latest \
    --add-cloudsql-instances $PROJECT_ID:$REGION:$DB_INSTANCE \
    --port 8080 \
    --memory 1Gi \
    --cpu 1 \
    --max-instances 10 \
    --min-instances 0 \
    --timeout 300s

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
