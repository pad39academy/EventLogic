# VS Code Setup Guide - Ievolve Event Management System

## Quick Setup Checklist

### ✅ Prerequisites
- [ ] Node.js 18+ installed
- [ ] VS Code installed  
- [ ] Git installed
- [ ] PostgreSQL database ready (Neon.tech recommended)

### ✅ VS Code Extensions (Recommended)
- [ ] Tailwind CSS IntelliSense
- [ ] ES7+ React/Redux/React-Native snippets
- [ ] PostgreSQL
- [ ] Thunder Client

### ✅ Project Setup
```bash
# 1. Extract ZIP and open in VS Code
# 2. Install dependencies
npm install

# 3. Create .env file with your database credentials
touch .env
```

### ✅ Environment Variables (.env)
```env
DATABASE_URL=postgresql://username:password@host:port/database
PGHOST=your_db_host
PGPORT=5432
PGDATABASE=your_db_name
PGUSER=your_db_user
PGPASSWORD=your_db_password

TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=your_twilio_phone

SESSION_SECRET=your_random_secret_here
```

### ✅ Database Setup
```bash
# Initialize database schema
npm run db:push

# Create admin user
node scripts/create-admin.js
```

### ✅ Start Development
```bash
# Start development server
npm run dev

# Open browser: http://localhost:5000
```

## Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:push` | Sync database schema |
| `npm run db:studio` | Open database GUI |
| `node scripts/create-admin.js` | Create admin user |

## Testing Your Setup

1. **Server Running**: Terminal shows "serving on port 5000"
2. **Database Connected**: No database errors in terminal
3. **Frontend Loading**: http://localhost:5000 opens correctly
4. **Admin Login**: Can create and login with admin account
5. **Upload Test**: Can upload PSV files successfully
6. **Dynamic Occupancy**: Room calculations update automatically

## Project Structure
```
├── client/src/           # React frontend
├── server/              # Express backend  
├── shared/              # Shared types
├── scripts/             # Database utilities
├── public/              # Static files
└── .env                 # Environment variables
```

## Troubleshooting

### Common Issues
- **Port in use**: `npx kill-port 5000`
- **Database errors**: Check .env file credentials
- **Dependencies**: `rm -rf node_modules && npm install`
- **TypeScript errors**: `npm run type-check`

### Database Connection Test
```bash
# Test database connection
node -e "const { Pool } = require('pg'); const pool = new Pool({ connectionString: process.env.DATABASE_URL }); pool.query('SELECT NOW()', (err, res) => { console.log(err ? err : res.rows[0]); pool.end(); });"
```

## Features to Test After Setup

### Admin Features
- [ ] Admin login with mobile + OTP
- [ ] Upload hotel inventory (PSV)
- [ ] Upload coaches/officials (PSV)
- [ ] Upload players (PSV)
- [ ] View dynamic occupancy calculations
- [ ] Hotel management and editing
- [ ] Participant management
- [ ] Manual occupancy recalculation

### Coach Features  
- [ ] Coach login with mobile + OTP
- [ ] View assigned players
- [ ] Check-in/check-out players
- [ ] SMS notifications

### Dynamic Occupancy System
- [ ] Upload participants and see occupancy update
- [ ] Room sharing rules: 3 players, 2 coaches, 1 official per room
- [ ] Real-time updates when modifying participants
- [ ] Manual recalculation button works

## Production Deployment

For production deployment, you'll need:
1. Production PostgreSQL database
2. Twilio account for SMS
3. Web hosting service (Vercel, Railway, etc.)
4. Environment variables configured in hosting platform

The system is ready for deployment with proper white-label error handling and professional UI for customer demonstrations.