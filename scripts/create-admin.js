#!/usr/bin/env node

/**
 * Script to create a new admin user for the Ievolve Event Management System
 * Usage: node scripts/create-admin.js
 */

const bcrypt = require('bcryptjs');
const { drizzle } = require('drizzle-orm/neon-serverless');
const { neon } = require('@neondatabase/serverless');
const { users } = require('../shared/schema');
const { eq, and } = require('drizzle-orm');
const readline = require('readline');

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function askPassword(question) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    
    process.stdout.write(question);
    
    let password = '';
    stdin.on('data', function(char) {
      char = char + '';
      switch(char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.pause();
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f': // Backspace
        case '\u0008':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    });
  });
}

async function createAdmin() {
  try {
    console.log('🔐 Ievolve Event Management System - Create Admin User\n');

    // Get database connection
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzle(sql);

    // Collect admin details
    const name = await askQuestion('Enter admin name: ');
    const email = await askQuestion('Enter admin email: ');
    const mobileNumber = await askQuestion('Enter admin mobile number (with country code, e.g., +919876543210): ');
    const password = await askPassword('Enter admin password: ');
    const confirmPassword = await askPassword('Confirm password: ');

    // Validate inputs
    if (!name || !email || !mobileNumber || !password) {
      console.error('❌ All fields are required');
      rl.close();
      return;
    }

    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match');
      rl.close();
      return;
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters long');
      rl.close();
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ Invalid email format');
      rl.close();
      return;
    }

    // Validate mobile number format
    if (!mobileNumber.startsWith('+')) {
      console.error('❌ Mobile number must include country code (e.g., +919876543210)');
      rl.close();
      return;
    }

    // Check if admin already exists
    const [existingEmailAdmin] = await db.select().from(users).where(
      and(eq(users.email, email), eq(users.role, 'admin'))
    );

    const [existingMobileAdmin] = await db.select().from(users).where(
      and(eq(users.mobileNumber, mobileNumber), eq(users.role, 'admin'))
    );

    if (existingEmailAdmin) {
      console.error('❌ Admin with this email already exists');
      rl.close();
      return;
    }

    if (existingMobileAdmin) {
      console.error('❌ Admin with this mobile number already exists');
      rl.close();
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const [newAdmin] = await db.insert(users).values({
      email,
      password: hashedPassword,
      mobileNumber,
      name,
      role: 'admin',
      isActive: true,
    }).returning();

    console.log('\n✅ Admin user created successfully!');
    console.log(`👤 Name: ${newAdmin.name}`);
    console.log(`📧 Email: ${newAdmin.email}`);
    console.log(`📱 Mobile: ${newAdmin.mobileNumber}`);
    console.log(`🆔 User ID: ${newAdmin.id}`);
    console.log('\nThe admin can now log in using:');
    console.log('1. Email and password for first step');
    console.log('2. OTP sent to mobile number for second step');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    rl.close();
  }
}

// Run the script
createAdmin();