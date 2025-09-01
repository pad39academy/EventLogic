# GitHub to Google Cloud Deployment Guide

## Step 1: Push Code to GitHub

### From Replit:
1. **Connect to GitHub** (if not already connected):
   - Go to your Replit project
   - Click "Version Control" (git icon) in the left sidebar
   - Connect your GitHub account
   - Create a new repository or connect to existing one

2. **Push your code**:
   ```bash
   git add .
   git commit -m "Initial commit - Ievolve Event Management System"
   git push origin main
   ```

## Step 2: Deploy from GitHub to Google Cloud

### Option A: Cloud Build with GitHub Integration

1. **Enable Cloud Build API** in your Google Cloud Console:
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   ```

2. **Connect GitHub to Cloud Build**:
   - Go to Cloud Build → Triggers
   - Click "Connect Repository"
   - Select GitHub and authorize
   - Choose your repository

3. **Create Build Trigger**:
   - Name: `ievolve-deploy`
   - Event: Push to branch
   - Branch: `main`
   - Configuration: Cloud Build configuration file
   - File location: `cloudbuild.yaml`

### Option B: Manual Deploy from GitHub

1. **Clone to Cloud Shell**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
   cd YOUR-REPO
   ```

2. **Configure Docker Authentication**:
   ```bash
   # Required for Docker deployment to Artifact Registry
   gcloud auth configure-docker asia-south1-docker.pkg.dev
   
   # Verify authentication
   gcloud auth list
   ```

3. **Run deployment script**:
   ```bash
   chmod +x deployment/deploy.sh
   ./deployment/deploy.sh
   ```

## Step 3: Environment Setup

### Required Environment Variables:
```bash
# Database
export DATABASE_URL="postgresql://user:password@host:port/database"

# Twilio (for SMS OTP)
export TWILIO_ACCOUNT_SID="your-twilio-sid"
export TWILIO_AUTH_TOKEN="your-twilio-token" 
export TWILIO_PHONE_NUMBER="your-twilio-number"

# Google Cloud
export PROJECT_ID="your-gcp-project-id"
export REGION="us-central1"
```

### Set in Cloud Run:
1. Go to Cloud Run → Select your service
2. Click "Edit & Deploy New Revision"
3. Go to "Variables & Secrets" tab
4. Add all environment variables

## Step 4: Database Migration

### Create Cloud SQL Instance:
```bash
# Create PostgreSQL instance
gcloud sql instances create ievolve-db \
    --database-version=POSTGRES_14 \
    --tier=db-f1-micro \
    --region=us-central1

# Create database
gcloud sql databases create ievolve --instance=ievolve-db

# Create user
gcloud sql users create ievolve-user --instance=ievolve-db --password=YOUR-SECURE-PASSWORD
```

### Migrate Data:
```bash
# Export from current database (Neon)
pg_dump $CURRENT_DATABASE_URL > backup.sql

# Import to Cloud SQL
gcloud sql import sql ievolve-db gs://your-bucket/backup.sql --database=ievolve
```

## Step 5: Custom Domain (Optional)

### Map Custom Domain:
```bash
gcloud run domain-mappings create \
    --service ievolve-app \
    --domain your-domain.com \
    --region us-central1
```

## Deployment Commands Summary:

```bash
# 1. Push to GitHub
git add .
git commit -m "Deploy to Google Cloud"
git push origin main

# 2. Deploy from Cloud Shell
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO
chmod +x deployment/deploy.sh
./deployment/deploy.sh

# 3. Set environment variables in Cloud Run console
# 4. Test your deployment at the provided Cloud Run URL
```

## Expected Costs:
- **Cloud Run**: $5-15/month (based on traffic)
- **Cloud SQL (f1-micro)**: $10-15/month
- **Cloud Build**: $0-5/month (first 120 builds free)
- **Total**: $15-35/month

## Post-Deployment:
- Your app will be available at: `https://ievolve-app-[hash]-uc.a.run.app`
- Admin login: `admin@ievolve.com` / `IevolveAdmin2025!`
- Monitor usage in Google Cloud Console

## Troubleshooting:
- Check Cloud Run logs for runtime errors
- Verify environment variables are set correctly
- Ensure Cloud SQL instance is accessible from Cloud Run
- Check Twilio credentials for SMS OTP functionality