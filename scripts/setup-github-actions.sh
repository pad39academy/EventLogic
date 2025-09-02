#!/bin/bash

# Setup GitHub Actions for Ievolve Event Management System
# This script helps you configure the GitHub repository secrets

echo "🔧 Setting up GitHub Actions for Ievolve Event Management"
echo "========================================================"
echo ""

echo "📋 You need to add these secrets to your GitHub repository:"
echo ""
echo "1. Go to your GitHub repository"
echo "2. Click Settings → Secrets and variables → Actions"
echo "3. Add the following repository secret:"
echo ""
echo "   Secret Name: GCP_SERVICE_ACCOUNT_KEY"
echo "   Secret Value: [Your Google Cloud Service Account JSON key]"
echo ""
echo "🔑 To get your service account key:"
echo "   1. Go to Google Cloud Console"
echo "   2. IAM & Admin → Service Accounts" 
echo "   3. Create or select a service account"
echo "   4. Add roles: Cloud Run Admin, Artifact Registry Writer"
echo "   5. Create and download JSON key"
echo "   6. Copy the entire JSON content as the secret value"
echo ""
echo "✅ Once set up, every time you create a release tag (v1, v2, v3...),"
echo "   GitHub Actions will automatically deploy to Google Cloud Run!"
echo ""