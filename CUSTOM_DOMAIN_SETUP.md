# Custom Domain Setup Guide - Hide Replit Branding

This guide explains how to set up a custom domain (like www.greatorsoftware.com) to completely hide Replit branding from your customers.

## Overview

Your Ievolve Event Management System now includes comprehensive white-label error handling to ensure customers never see Replit branding, even during server failures.

## What's Implemented

### 1. Custom Error Handler Middleware
- **Location**: `server/middleware/error-handler.ts`
- **Function**: Intercepts all server errors and serves branded maintenance pages
- **Coverage**: Both API errors (JSON) and web errors (HTML)

### 2. Static Error Pages (Work Even When Server is Down)
- **public/503.html**: Service unavailable page served by reverse proxy
- **public/404.html**: Page not found with branded design
- **Features**: Professional branding, auto-retry, contact support links

### 3. Application Error Pages (When Server is Running)
- **error-page.html**: Standalone error page for direct access
- **mobile-iframe.html**: Mobile-optimized iframe wrapper with error handling
- **Middleware handling**: Real-time error interception and branded responses

### 4. Reverse Proxy Configuration
- **nginx.conf**: Complete Nginx configuration for professional deployment
- **Custom error handling**: Routes all errors to branded pages
- **Upstream failure handling**: Graceful fallback when Replit is down

## Custom Domain Setup Process

### Option A: Direct DNS (Simple Setup)
Point your custom domain directly to Replit:
```
Type: CNAME
Name: www (or @)
Value: your-replit-url.replit.dev
```
**Limitation**: Customers may see Replit errors if server is completely down.

### Option B: Reverse Proxy (Professional Setup - Recommended)
Use a reverse proxy server (Nginx/Apache) to completely hide Replit:

1. **Set up your own server** (VPS, AWS, etc.)
2. **Install Nginx** and use the provided `nginx.conf`
3. **Point DNS to your server**:
   ```
   Type: A
   Name: www (or @)
   Value: YOUR-SERVER-IP
   ```
4. **Copy static error pages** to `/app/public/` on your server
5. **Configure SSL** for HTTPS support

### Step 3: Test Error Handling
1. Visit your custom domain: `https://www.greatorsoftware.com`
2. **Test server failures** to verify branded error pages appear
3. **Test complete downtime** (only works with reverse proxy setup)
4. Confirm no Replit references are visible anywhere

## Error Handling Features

### Professional Maintenance Pages
- **Branded Headers**: "IEVOLVE EVENT MANAGEMENT"
- **Event Context**: "Chief Minister Trophy - Tamil Nadu"
- **Professional Messaging**: System maintenance without technical details
- **Contact Support**: Direct email link to support@greatorsoftware.com

### Auto-Recovery System
- **Periodic Checks**: Tests server status every 10-15 seconds
- **Smart Retry**: Automatically reloads when service is restored
- **User Control**: Manual "Try Again" button for immediate retry

### Mobile Optimization
- **Responsive Design**: Works on all device sizes
- **Touch-Friendly**: Large buttons and clear text
- **Fullscreen Mode**: Optional fullscreen for mobile demos

## API Error Responses

Instead of Replit errors, customers see:
```json
{
  "error": "Service temporarily unavailable",
  "message": "Our event management system is undergoing maintenance. Please try again shortly.",
  "status": 500
}
```

## File Structure

```
├── server/middleware/error-handler.ts    # Custom error handling logic
├── public/503.html                       # Service unavailable (reverse proxy)
├── public/404.html                       # Page not found (reverse proxy)
├── error-page.html                       # Standalone error page
├── mobile-iframe.html                    # Mobile wrapper with error handling
├── nginx.conf                            # Reverse proxy configuration
└── server/index.ts                       # Error middleware integration
```

## Complete Protection Levels

### Level 1: Application-Level Protection
- **What's Protected**: Server errors while app is running
- **What's NOT Protected**: Complete server downtime
- **Setup**: Already implemented in your app

### Level 2: Reverse Proxy Protection (Recommended)
- **What's Protected**: ALL errors, even complete server failures
- **What's NOT Protected**: Nothing (100% white-label)
- **Setup**: Requires reverse proxy server (see nginx.conf)

## Testing Checklist

### Basic Tests (Both Setups)
- [ ] Custom domain resolves correctly
- [ ] Server errors show branded maintenance page
- [ ] API errors return professional JSON responses
- [ ] Auto-retry functionality works
- [ ] Mobile error pages display properly
- [ ] No Replit branding visible anywhere
- [ ] Support contact links work correctly

### Advanced Tests (Reverse Proxy Only)
- [ ] Complete server shutdown shows branded 503 page
- [ ] Invalid URLs show branded 404 page
- [ ] Auto-recovery when server comes back online
- [ ] SSL/HTTPS works correctly
- [ ] No Replit headers or references in HTTP responses

## Customer Demo Setup

For customer demonstrations:
1. Use custom domain: `https://www.greatorsoftware.com`
2. Show error handling during "maintenance windows"
3. Demonstrate professional appearance throughout
4. Highlight seamless auto-recovery features

## Maintenance Notes

- Error pages automatically update with your branding
- No manual configuration needed for new deployments
- All error handling is built into the application
- Custom domain changes require DNS updates only

Your customers will now see a professional, branded experience even during system failures, with no indication that Replit is powering the infrastructure.