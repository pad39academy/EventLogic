# Custom Domain Setup Guide - Hide Replit Branding

This guide explains how to set up a custom domain (like www.greatorsoftware.com) to completely hide Replit branding from your customers.

## Overview

Your Ievolve Event Management System now includes comprehensive white-label error handling to ensure customers never see Replit branding, even during server failures.

## What's Implemented

### 1. Custom Error Handler Middleware
- **Location**: `server/middleware/error-handler.ts`
- **Function**: Intercepts all server errors and serves branded maintenance pages
- **Coverage**: Both API errors (JSON) and web errors (HTML)

### 2. Professional Error Pages
- **API Errors**: Return branded JSON responses without Replit references
- **Web Errors**: Show "Ievolve Event Management - System Maintenance" pages
- **Auto-retry**: 30-second countdown with automatic reload attempts

### 3. Static Error Files
- **error-page.html**: Standalone error page for direct access
- **mobile-iframe.html**: Mobile-optimized iframe wrapper with error handling
- **Features**: Professional branding, auto-retry, contact support links

## Custom Domain Setup Process

### Step 1: Configure DNS
Point your custom domain to Replit:
```
Type: CNAME
Name: www (or @)
Value: your-replit-url.replit.dev
```

### Step 2: Update Application URLs
The system now uses relative URLs (`/api/auth/me` instead of full Replit URLs) for seamless custom domain support.

### Step 3: Test Error Handling
1. Visit your custom domain: `https://www.greatorsoftware.com`
2. Test server failures to verify branded error pages appear
3. Confirm no Replit references are visible

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
├── error-page.html                       # Standalone error page
├── mobile-iframe.html                    # Mobile wrapper with error handling
└── server/index.ts                       # Error middleware integration
```

## Testing Checklist

- [ ] Custom domain resolves correctly
- [ ] Server errors show branded maintenance page
- [ ] API errors return professional JSON responses
- [ ] Auto-retry functionality works
- [ ] Mobile error pages display properly
- [ ] No Replit branding visible anywhere
- [ ] Support contact links work correctly

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