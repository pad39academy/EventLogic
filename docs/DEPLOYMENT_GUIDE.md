# Google Cloud Deployment Guide for Ievolve Event Management System

## Prerequisites

1. **Google Cloud Account** with billing enabled
2. **Google Cloud CLI** installed and authenticated
3. **Docker** installed (optional, Cloud Build will handle it)
4. **Your Twilio credentials** for SMS functionality

## Quick Deployment (Recommended)

### Step 1: Setup Google Cloud Project

```bash
# Create and set up project (use your own unique project ID)
gcloud projects create your-unique-project-id
gcloud config set project your-unique-project-id

# Update deployment/deploy.sh with your project ID
# Edit the PROJECT_ID variable to match your actual project
```

**Important**: Update the `PROJECT_ID` variable in `deployment/deploy.sh` to match your actual Google Cloud project ID.

### Step 2: Enable Billing (REQUIRED)

**⚠️ CRITICAL: You MUST enable billing before proceeding!**

1. Visit: https://console.cloud.google.com/billing
2. Select your project: `your-unique-project-id`
3. Click "Link a billing account"
4. Choose or create a billing account
5. Verify billing is enabled before continuing

Without billing enabled, the deployment will fail when trying to create Cloud SQL, Cloud Run, or other services.

### Step 2.5: Setup IAM Permissions (If Needed)

If you encounter permission errors, add necessary roles to your account:

```bash
# Replace with your actual project ID and email
gcloud projects add-iam-policy-binding your-unique-project-id \
    --member="user:your-email@domain.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding your-unique-project-id \
    --member="user:your-email@domain.com" \
    --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding your-unique-project-id \
    --member="user:your-email@domain.com" \
    --role="roles/storage.admin"
```

### Step 2.6: Configure Docker Authentication

**Required for Docker deployment:**

```bash
# Configure Docker to authenticate with Google Artifact Registry
gcloud auth configure-docker asia-south1-docker.pkg.dev

# Verify authentication is working
gcloud auth list
```

**Note**: This step is essential for pushing Docker images to Google Artifact Registry. Without proper authentication, you'll receive "Unauthenticated request" errors when deploying.

### Step 3: Run the Automated Deployment

```bash
# Make deployment script executable
chmod +x deployment/deploy.sh

# Run the deployment
./deployment/deploy.sh
```

## Manual Docker Deployment (Alternative)

If you prefer to build and deploy manually instead of using the automated script:

### Step 3A: Manual Docker Build and Push

```bash
# Build the Docker image
docker buildx build --no-cache --platform linux/amd64 -f Dockerfile-fixed -t asia-south1-docker.pkg.dev/ievolve-sports-2025/ievolve-repo/ievolve-app:latest .

# Push to Artifact Registry
docker push asia-south1-docker.pkg.dev/ievolve-sports-2025/ievolve-repo/ievolve-app:latest

# Deploy to Cloud Run
gcloud run deploy ievolve-app \
  --image=asia-south1-docker.pkg.dev/ievolve-sports-2025/ievolve-repo/ievolve-app:latest \
  --region=asia-south1 \
  --allow-unauthenticated \
  --set-env-vars='DATABASE_URL=postgresql://ievolve_user:IevolveSecure2025!@/ievolve_db?host=/cloudsql/ievolve-sports-2025:asia-south1:ievolve-db,NODE_ENV=production' \
  --add-cloudsql-instances=ievolve-sports-2025:asia-south1:ievolve-db \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --project=ievolve-sports-2025
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

# CRITICAL: Grant Cloud Run service account access to secrets
# Get your project number (needed for the service account)
PROJECT_NUMBER=$(gcloud projects describe ievolve-sports-2025 --format="value(projectNumber)")

# Grant access to each secret
gcloud secrets add-iam-policy-binding twilio-account-sid \
    --role="roles/secretmanager.secretAccessor" \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding twilio-auth-token \
    --role="roles/secretmanager.secretAccessor" \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding twilio-phone-number \
    --role="roles/secretmanager.secretAccessor" \
    --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"

# Redeploy with updated secrets
gcloud run deploy ievolve-app \
    --image gcr.io/ievolve-event-management/ievolve-app \
    --region us-central1 \
    --set-secrets TWILIO_ACCOUNT_SID=twilio-account-sid:latest \
    --set-secrets TWILIO_AUTH_TOKEN=twilio-auth-token:latest \
    --set-secrets TWILIO_PHONE_NUMBER=twilio-phone-number:latest
```

### Step 5: Setup Database Schema

**Option A: Create Tables from Scratch (New Database)**

```bash
# Push database schema to production (creates all tables)
npm run db:push

# Note: You may need to add --force if there are data loss warnings
# npm run db:push -- --force
```

**Option B: Migrate Existing Data**

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

#### 1. Permission Errors During Deployment

If you get permission errors like "does not have permission to access namespaces", fix IAM permissions:

```bash
# Add necessary Cloud Run roles
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="user:your-email@domain.com" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="user:your-email@domain.com" \
    --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
    --member="user:your-email@domain.com" \
    --role="roles/storage.admin"
```

#### 2. Project ID Mismatch

If image paths don't match your project, ensure consistency:

```bash
# Set correct project
gcloud config set project YOUR_ACTUAL_PROJECT_ID

# Build image in correct project
gcloud builds submit --tag gcr.io/YOUR_ACTUAL_PROJECT_ID/ievolve-app

# Deploy with matching image path
gcloud run deploy ievolve-app \
    --image gcr.io/YOUR_ACTUAL_PROJECT_ID/ievolve-app \
    --region us-central1 \
    --allow-unauthenticated
```

#### 3. Build fails
Check Dockerfile and dependencies

#### 4. Database connection fails
Verify Cloud SQL instance and secrets

#### 4.1. Database Schema Setup in Cloud Shell

When setting up the database schema from Google Cloud Shell, follow these specific steps:

```bash
# 1. Set the correct project
gcloud config set project ievolve-sports-2025

# 2. Navigate to the project directory (important!)
cd ~/Ievolve-mvp1.0

# 3. Set DATABASE_URL for localhost connection
# Use localhost instead of external IP to avoid connection timeouts
export DATABASE_URL='postgresql://ievolve_user:IevolveSecure2025!@localhost:5432/ievolve_db'

# 4. Push database schema
npm run db:push
```

**Important Notes:**
- **Directory**: Always ensure you're in the correct project directory (`~/Ievolve-mvp1.0`) before running npm commands
- **Database URL**: Use `localhost` instead of external IP addresses to avoid `ETIMEDOUT` errors
- **Connection**: The localhost connection works because Cloud Shell provides secure access to Cloud SQL instances within the same project

**Common Errors and Solutions:**

❌ **Error: `ENOENT: no such file or directory, open '/home/username/package.json'`**
```bash
# Solution: Navigate to the correct directory
cd ~/Ievolve-mvp1.0
```

❌ **Error: `connect ETIMEDOUT 34.93.185.14:5432`**
```bash
# Problem: Using external IP address
export DATABASE_URL='postgresql://ievolve_user:IevolveSecure2025!@34.93.185.14:5432/ievolve_db'

# Solution: Use localhost instead
export DATABASE_URL='postgresql://ievolve_user:IevolveSecure2025!@localhost:5432/ievolve_db'
```

✅ **Successful Output:**
```
[✓] Pulling schema from database...
[✓] Changes applied
```

#### 4.2. Admin User Creation in Cloud Shell

The admin creation script (`scripts/create-admin.js`) is designed for Neon database but your deployment uses PostgreSQL. Here's how to create admin users properly:

**Option A: Direct SQL Method (Recommended)**

```bash
# 1. Connect to your Cloud SQL database
gcloud sql connect ievolve-db --user=ievolve_user --database=ievolve_db

# 2. Create admin user directly with SQL
# Replace the values with your actual admin details
# Password will be hashed automatically by bcrypt in the application
```

**SQL to execute:**
```sql
-- Generate bcrypt hash for password 'IevolveAdmin2025!*' (cost 10)
-- You can use an online bcrypt generator or the application's hash function
INSERT INTO users (email, password, mobile_number, name, role, is_active) 
VALUES (
  'gunasekaran@greatorsoftware.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- This is bcrypt hash for "password123"
  '+916385629910',
  'Greator',
  'admin',
  true
);
```

**Option B: Fix the Admin Script (Alternative)**

If you prefer to use the script, create a modified version for PostgreSQL:

```bash
# Create a PostgreSQL-compatible admin script
cat > scripts/create-admin-postgres.js << 'EOF'
#!/usr/bin/env node

import bcrypt from 'bcryptjs';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { users } from '../shared/schema.ts';
import { eq, and } from 'drizzle-orm';
import readline from 'readline';

// Use PostgreSQL connection instead of Neon
const sql = postgres(process.env.DATABASE_URL);
const db = drizzle(sql);

// Rest of the script remains the same...
// (Copy the remaining content from the original script)
EOF

# Then run the modified script
export DATABASE_URL='postgresql://ievolve_user:IevolveSecure2025!@localhost:5432/ievolve_db'
node scripts/create-admin-postgres.js
```

**Common Error:**
❌ **Error: `TypeError: fetch failed`**
- **Cause**: The original script uses Neon driver which doesn't work with regular PostgreSQL
- **Solution**: Use Option A (direct SQL) or Option B (modified script)

**Quick Bcrypt Hash Generation:**
```javascript
// To generate a bcrypt hash for your password, run in node:
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('IevolveAdmin2025!*', 10);
console.log(hash);
```

#### 5. SMS not working
Update Twilio credentials

#### 6. "Already Exists" Errors During Re-deployment

If you see errors like "database already exists" or "Secret already exists", these are normal for re-runs:

```bash
# The updated deployment script now handles these gracefully
# Simply re-run the deployment script:
./deployment/deploy.sh

# Or continue with just the build and deploy steps:
gcloud builds submit --tag asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/ievolve-repo/ievolve-app
gcloud run deploy ievolve-app \
    --image asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/ievolve-repo/ievolve-app \
    --region asia-south1 \
    --allow-unauthenticated
```

#### 7. Cloud Build "--no-cache" Error

If you encounter "Cannot specify --no-cache if builds/use_kaniko property is False":

```bash
# Enable Kaniko for Cloud Build
gcloud config set builds/use_kaniko True

# Then retry the build
gcloud builds submit --tag asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/ievolve-repo/ievolve-app
```

#### 8. Performance issues
Increase memory/CPU allocation

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
