#!/usr/bin/env node

/**
 * Simple script to create admin user using direct PostgreSQL connection
 * Usage: node scripts/create-admin-simple.js
 */

import bcrypt from 'bcryptjs';
import { Client } from 'pg';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });

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

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function createAdmin() {
  let client;
  
  try {
    console.log('🔐 Ievolve Event Management System - Create Admin User\n');

    // Create database client
    client = new Client({
      connectionString: process.env.DATABASE_URL
    });
    
    await client.connect();
    console.log('✅ Connected to database\n');

    // Collect admin details
    const name = await askQuestion('Enter admin name: ');
    const email = await askQuestion('Enter admin email: ');
    const mobileNumber = await askQuestion('Enter admin mobile number (with country code, e.g., +919876543210): ');
    const password = await askPassword('Enter admin password: ');
    const confirmPassword = await askPassword('Confirm password: ');

    // Validate inputs
    if (!name || !email || !mobileNumber || !password) {
      console.error('❌ All fields are required');
      return;
    }

    if (password !== confirmPassword) {
      console.error('❌ Passwords do not match');
      return;
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters long');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('❌ Invalid email format');
      return;
    }

    // Validate mobile number format
    if (!mobileNumber.startsWith('+')) {
      console.error('❌ Mobile number must include country code (e.g., +919876543210)');
      return;
    }

    // Check if admin already exists
    const existingEmailQuery = 'SELECT * FROM users WHERE email = $1 AND role = $2';
    const existingEmailResult = await client.query(existingEmailQuery, [email, 'admin']);

    const existingMobileQuery = 'SELECT * FROM users WHERE mobile_number = $1 AND role = $2';
    const existingMobileResult = await client.query(existingMobileQuery, [mobileNumber, 'admin']);

    if (existingEmailResult.rows.length > 0) {
      console.error('❌ Admin with this email already exists');
      return;
    }

    if (existingMobileResult.rows.length > 0) {
      console.error('❌ Admin with this mobile number already exists');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create admin user
    const insertQuery = `
      INSERT INTO users (id, email, password, mobile_number, name, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const userId = generateUUID();
    const now = new Date();
    
    const result = await client.query(insertQuery, [
      userId,
      email,
      hashedPassword,
      mobileNumber,
      name,
      'admin',
      true,
      now,
      now
    ]);

    const newAdmin = result.rows[0];

    console.log('\n✅ Admin user created successfully!');
    console.log(`👤 Name: ${newAdmin.name}`);
    console.log(`📧 Email: ${newAdmin.email}`);
    console.log(`📱 Mobile: ${newAdmin.mobile_number}`);
    console.log(`🆔 User ID: ${newAdmin.id}`);
    console.log('\nThe admin can now log in using:');
    console.log('1. Email and password for first step');
    console.log('2. OTP sent to mobile number for second step');
    console.log('\nYou can now start the application with: npm run dev');

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    if (client) {
      await client.end();
    }
    rl.close();
  }
}

// Run the script
createAdmin();