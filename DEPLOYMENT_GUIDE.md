# Google Cloud Deployment Guide for Ievolve Event Management System

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud CLI** installed and authenticated
3. **Docker** installed (optional, Cloud Build will handle it)
4. **Your Twilio credentials** for SMS functionality

## Quick Deployment (Recommended)

### Step 1: Setup Google Cloud Project

```bash
# Create and set up project
gcloud projects create ievolve-event-management
gcloud config set project ievolve-event-management
```

### Step 2: Enable Billing (REQUIRED)

**⚠️ CRITICAL: You MUST enable billing before proceeding!**

1. Visit: https://console.cloud.google.com/billing
2. Select your project: `ievolve-event-management`
3. Click "Link a billing account"
4. Choose or create a billing account
5. Verify billing is enabled before continuing

Without billing enabled, the deployment will fail when trying to create Cloud SQL, Cloud Run, or other services.

### Step 3: Run the Automated Deployment

```bash
# Make deployment script executable
chmod +x deployment/deploy.sh

# Run the deployment
./deployment/deploy.sh
```

### Step 4: Configure Twilio Secrets

After the deployment script completes, update your Twilio credentials:

```bash
# Replace with your actual Twilio credentials
gcloud secrets create twilio-account-sid --data-file=- <<< 'YOUR_TWILIO_ACCOUNT_SID'
gcloud secrets create twilio-auth-token --data-file=- <<< 'YOUR_TWILIO_AUTH_TOKEN'
gcloud secrets create twilio-phone-number --data-file=- <<< 'YOUR_TWILIO_PHONE_NUMBER'

To validate the credentials:

gcloud secrets versions access latest --secret="twilio-account-sid"
gcloud secrets versions access latest --secret="twilio-auth-token"
gcloud secrets versions access latest --secret="twilio-phone-number"

# Redeploy with updated secrets
gcloud run deploy ievolve-app \
    --image gcr.io/ievolve-event-management/ievolve-app \
    --region us-central1 \
    --set-secrets TWILIO_ACCOUNT_SID=twilio-account-sid:latest \
    --set-secrets TWILIO_AUTH_TOKEN=twilio-auth-token:latest \
    --set-secrets TWILIO_PHONE_NUMBER=twilio-phone-number:latest
```

### Step 5: Migrate Your Database

```bash
# Export current database (run locally)
pg_dump $DATABASE_URL > ievolve_backup.sql

# Upload to Google Cloud Storage
gsutil mb gs://ievolve-db-backup
gsutil cp ievolve_backup.sql gs://ievolve-db-backup/

# Import to Cloud SQL
gcloud sql import sql ievolve-postgres gs://ievolve-db-backup/ievolve_backup.sql --database=ievolve_db
```

## Manual Deployment Steps

If you prefer to deploy step by step:

### 1. Enable Google Cloud APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable sqladmin.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Cloud SQL Database

```bash
# Create PostgreSQL instance
gcloud sql instances create ievolve-postgres \
    --database-version=POSTGRES_15 \
    --tier=db-f1-micro \
    --region=us-central1

# Create database and user
gcloud sql databases create ievolve_db --instance=ievolve-postgres
gcloud sql users create ievolve_user \
    --instance=ievolve-postgres \
    --password=IevolveSecure2025!
```

### 3. Setup Secrets

```bash
# Database credentials
echo "IevolveSecure2025!" | gcloud secrets create db-password --data-file=-
echo "postgresql://ievolve_user:IevolveSecure2025!@/ievolve_db?host=/cloudsql/ievolve-event-management:us-central1:ievolve-postgres" | gcloud secrets create database-url --data-file=-

# Twilio credentials (replace with actual values)
echo "YOUR_TWILIO_ACCOUNT_SID" | gcloud secrets create twilio-account-sid --data-file=-
echo "YOUR_TWILIO_AUTH_TOKEN" | gcloud secrets create twilio-auth-token --data-file=-
echo "YOUR_TWILIO_PHONE_NUMBER" | gcloud secrets create twilio-phone-number --data-file=-
```

### 4. Build and Deploy

```bash
# Build the container
gcloud builds submit --tag gcr.io/ievolve-event-management-2025/ievolve-app

# Deploy to Cloud Run
gcloud run deploy ievolve-app \
    --image gcr.io/ievolve-event-management/ievolve-app \
    --region us-central1 \
    --allow-unauthenticated \
    --set-env-vars NODE_ENV=production \
    --set-secrets DATABASE_URL=database-url:latest \
    --set-secrets TWILIO_ACCOUNT_SID=twilio-account-sid:latest \
    --set-secrets TWILIO_AUTH_TOKEN=twilio-auth-token:latest \
    --set-secrets TWILIO_PHONE_NUMBER=twilio-phone-number:latest \
    --add-cloudsql-instances ievolve-event-management:us-central1:ievolve-postgres \
    --port 8080 \
    --memory 1Gi \
    --max-instances 10
```

## Post-Deployment

### 1. Get Application URL

```bash
gcloud run services describe ievolve-app --region=us-central1 --format="value(status.url)"
```

### 2. Test the Application

Visit your application URL and:
1. Test admin login with SMS OTP
2. Test coach login functionality
3. Verify file uploads work
4. Check SMS notifications

### 3. Set up Custom Domain (Optional)

```bash
# Map custom domain
gcloud run domain-mappings create \
    --service ievolve-app \
    --domain yourdomain.com \
    --region us-central1
```

## Monitoring & Maintenance

### View Logs

```bash
# View application logs
gcloud run services logs read ievolve-app --region=us-central1

# View database logs
gcloud sql operations list --instance=ievolve-postgres
```

### Scaling Configuration

```bash
# Update resource limits
gcloud run services update ievolve-app \
    --region=us-central1 \
    --memory=2Gi \
    --cpu=2 \
    --max-instances=20 \
    --min-instances=1
```

### Cost Optimization

- **Free Tier**: 2 million requests/month free on Cloud Run
- **Database**: Start with db-f1-micro ($7-15/month)
- **Storage**: Minimal cost for file uploads
- **Estimated monthly cost**: $15-30 for small to medium usage

## Troubleshooting

### Common Issues

1. **Build fails**: Check Dockerfile and dependencies
2. **Database connection fails**: Verify Cloud SQL instance and secrets
3. **SMS not working**: Update Twilio credentials
4. **Performance issues**: Increase memory/CPU allocation

### Useful Commands

```bash
# Check service status
gcloud run services describe ievolve-app --region=us-central1

# Update environment variables
gcloud run services update ievolve-app \
    --region=us-central1 \
    --set-env-vars NEW_VAR=value

# Rollback deployment
gcloud run services update ievolve-app \
    --region=us-central1 \
    --image=gcr.io/ievolve-event-management/ievolve-app:PREVIOUS_TAG
```

## Security Best Practices

1. **IAM**: Use service accounts with minimal permissions
2. **Secrets**: Store all sensitive data in Secret Manager
3. **Network**: Consider VPC connector for private communication
4. **Authentication**: Enable IAM authentication for production
5. **Monitoring**: Set up Cloud Monitoring alerts

Your Ievolve Event Management System is now ready for production on Google Cloud! 🚀
