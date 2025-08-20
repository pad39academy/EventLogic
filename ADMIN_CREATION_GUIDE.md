# Admin User Creation Guide

## Overview
The Ievolve Event Management System uses a dual-authentication system for admin users:
1. **Email + Password** for initial authentication
2. **SMS OTP** to the admin's mobile number for second-factor authentication

## Methods to Create New Admin Users

### Method 1: Using the Admin Creation Script (Recommended)

1. **Navigate to the project root directory**
   ```bash
   cd /path/to/ievolve-project
   ```

2. **Run the admin creation script**
   ```bash
   node scripts/create-admin.js
   ```

3. **Follow the interactive prompts:**
   - Enter admin name (e.g., "John Smith")
   - Enter admin email (e.g., "john.smith@ievolve.com")
   - Enter mobile number with country code (e.g., "+919876543210")
   - Enter password (minimum 8 characters)
   - Confirm password

4. **Verification:**
   The script will validate:
   - All required fields are provided
   - Email format is valid
   - Mobile number includes country code
   - Password meets minimum requirements
   - No duplicate email or mobile number exists

### Method 2: Manual Database Insertion

If you prefer to create admin users manually or through database tools:

1. **Required Information:**
   - Name: Full name of the admin
   - Email: Unique email address
   - Mobile Number: Unique mobile with country code
   - Password: Will be hashed using bcrypt

2. **Database Schema:**
   ```sql
   INSERT INTO users (
     email, 
     password, 
     mobile_number, 
     name, 
     role, 
     is_active
   ) VALUES (
     'admin@example.com',
     '$2b$10$hashedpasswordhere',
     '+919876543210',
     'Admin Name',
     'admin',
     true
   );
   ```

3. **Password Hashing:**
   You must hash passwords using bcrypt with salt rounds = 10:
   ```javascript
   const bcrypt = require('bcryptjs');
   const hashedPassword = await bcrypt.hash('yourpassword', 10);
   ```

### Method 3: Through Application Code

Add admin creation logic to your application startup or create a special endpoint:

```javascript
const bcrypt = require('bcryptjs');
const { users } = require('./shared/schema');

async function createAdmin(name, email, mobileNumber, password) {
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const [admin] = await db.insert(users).values({
    email,
    password: hashedPassword,
    mobileNumber,
    name,
    role: 'admin',
    isActive: true,
  }).returning();
  
  return admin;
}
```

## Admin Login Process

Once created, admins log in using this two-step process:

### Step 1: Email/Password Authentication
- POST `/api/auth/admin/login`
- Body: `{ email: "admin@example.com", password: "password123" }`
- Response: Confirmation that OTP has been sent to mobile

### Step 2: OTP Verification  
- POST `/api/auth/admin/verify-otp`
- Body: `{ mobileNumber: "+919876543210", otp: "123456" }`
- Response: Login success with user session

## Security Features

1. **Password Hashing:** All passwords are hashed using bcrypt with salt rounds = 10
2. **Unique Constraints:** Email and mobile numbers must be unique
3. **Two-Factor Authentication:** SMS OTP required for login
4. **Session Management:** Secure session storage with PostgreSQL
5. **Audit Logging:** All admin actions are logged

## Default Admin Account

The system creates a default admin account on startup:
- **Email:** admin@ievolve.com
- **Password:** IevolveAdmin2025!
- **Mobile:** +918888888888
- **Name:** System Admin

**⚠️ Important:** Change the default admin credentials immediately in production!

## Troubleshooting

### Common Issues:

1. **"Admin with this email already exists"**
   - Use a different email address
   - Check existing users in database

2. **"Mobile number must include country code"**
   - Ensure mobile starts with + (e.g., +919876543210)
   - Use international format

3. **"Password must be at least 8 characters"**
   - Use a stronger password with minimum 8 characters

4. **OTP not received during login**
   - Check if Twilio credentials are configured
   - Verify mobile number format
   - Check SMS service logs

### Database Queries for Admin Management:

```sql
-- List all admin users
SELECT id, name, email, mobile_number, is_active, created_at 
FROM users 
WHERE role = 'admin';

-- Deactivate an admin
UPDATE users 
SET is_active = false 
WHERE email = 'admin@example.com' AND role = 'admin';

-- Reset admin password (remember to hash it first)
UPDATE users 
SET password = '$2b$10$newhashedpassword' 
WHERE email = 'admin@example.com' AND role = 'admin';
```

## SMS Configuration

For OTP functionality, ensure your environment has:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token  
TWILIO_PHONE_NUMBER=your_twilio_number
```

## Next Steps After Creating Admin

1. Test the login process with the new credentials
2. Update mobile number and password if using default values
3. Set up proper SMS service credentials for production
4. Consider creating role-based permissions if needed
5. Document admin credentials securely