# Technical Admin User Setup Guide

## Overview

The Ievolve Event Management System supports a specialized "Technical Admin" role for managing technical features like failed batches, database optimization, and system health monitoring. This guide explains how to create and manage technical admin users.

## User Role Structure

The system supports three distinct user roles:

- **`admin`** - Regular business admin (hotels, participants, reports, notifications)
- **`coach`** - Team coaches (participant check-in/check-out via OTP)
- **`technical_admin`** - Technical features (failed batches, database tools, system health)

## Creating Technical Admin Users

### Method 1: Direct Database Creation

Use this SQL command to create a technical admin user directly in the database:

```sql
-- Create technical admin user
INSERT INTO users (email, password, name, role, is_active) 
VALUES (
  'tech@ievolve.com', 
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 
  'Technical Admin', 
  'technical_admin', 
  true
);
```

**Security Note**: The password hash above is for "password" - replace with a secure hashed password in production.

### Method 2: Programmatic Creation (Optional)

Add this route to `server/routes.ts` for programmatic creation:

```typescript
app.post('/api/admin/create-technical-admin', requireAuth, async (req, res) => {
  // Only allow regular admins to create technical admins
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create technical admin users' });
  }
  
  const { email, password, name } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const newUser = await storage.createUser({
    email,
    password: hashedPassword,
    name,
    role: 'technical_admin',
    isActive: true
  });
  
  res.json({ user: newUser });
});
```

## Default Technical Admin Account

A default technical admin account has been created:

- **Email**: `tech@ievolve.com`
- **Password**: `password` (change this in production)
- **Role**: `technical_admin`
- **Status**: Active

## Accessing Technical Admin Dashboard

### Login Process
1. Use the regular admin login form at `/`
2. Enter technical admin credentials
3. System automatically redirects to `/technical-admin-dashboard`

### Dashboard Features
Technical admin dashboard includes:

- **Failed Batches** - View and manage failed upload batches with recovery options
- **DB Optimize** - Database performance optimization tools and diagnostics
- **System Health** - Real-time system monitoring and performance metrics

### URL Access
- Main dashboard: `/technical-admin-dashboard`
- Alternative routes: `/technical-admin`

## Security Considerations

### Password Management
- Use strong, unique passwords for technical admin accounts
- Consider implementing password rotation policies
- Hash passwords using bcrypt with appropriate salt rounds

### Access Control
- Technical admins have separate permissions from regular admins
- No access to business admin features (hotels, participants, reports)
- Focused on technical and system administration tasks

### Audit Trail
- All technical admin actions are logged through the event system
- Database operations are tracked for compliance

## User Management

### Listing Technical Admins
```sql
-- View all technical admin users
SELECT id, name, email, role, is_active, created_at 
FROM users 
WHERE role = 'technical_admin';
```

### Deactivating Technical Admin
```sql
-- Deactivate technical admin user
UPDATE users 
SET is_active = false 
WHERE email = 'tech@ievolve.com' AND role = 'technical_admin';
```

### Updating Technical Admin Password
```sql
-- Update password (use bcrypt hash)
UPDATE users 
SET password = '$2a$10$NewHashedPasswordHere' 
WHERE email = 'tech@ievolve.com' AND role = 'technical_admin';
```

## Dashboard Separation Benefits

### Clean Interface Separation
- **Regular Admin**: Business features only (hotels, participants, reports, notifications)
- **Technical Admin**: Technical features only (failed batches, database tools, monitoring)

### Role-Based Access
- Prevents technical complexity from cluttering business admin interface
- Allows specialized access for technical support staff
- Maintains security boundaries between business and technical operations

### Navigation
- Separate navigation menus for each role type
- Mobile-responsive design for both dashboards
- Clear visual distinction between admin types

## Troubleshooting

### Login Issues
- Verify user exists: `SELECT * FROM users WHERE email = 'tech@ievolve.com'`
- Check role is correct: `technical_admin` (not `admin`)
- Confirm account is active: `is_active = true`

### Access Denied
- Technical admins cannot access regular admin features
- Regular admins cannot access technical admin features
- Role separation is enforced at route level

### Dashboard Not Loading
- Check browser console for JavaScript errors
- Verify technical admin dashboard component is properly imported
- Confirm routing is configured for technical admin paths

## Integration with Existing System

### Database Schema
- Uses existing `users` table with new `technical_admin` role enum value
- No additional tables required
- Backward compatible with existing admin and coach users

### Authentication Flow
- Uses same session-based authentication system
- Role-based routing implemented in `App.tsx`
- Session validation works across all user types

### Component Architecture
- `technical-admin-dashboard.tsx` - Main technical admin interface
- `failed-batches-section.tsx` - Failed batch management (moved from admin)
- Database optimization components available to technical admin only

---

**Last Updated**: September 2025
**System Version**: Ievolve Event Management v2.0