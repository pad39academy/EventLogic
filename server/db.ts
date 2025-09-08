import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create connection pool with improved timeout handling for long-running operations
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 300000,     // 5 minutes - increased from 30 seconds
  connectionTimeoutMillis: 60000, // 1 minute - increased from 10 seconds
  allowExitOnIdle: true,
});

// Add error handling for pool connection issues
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  // Don't exit the process on database errors - let the app continue
});

// Handle connection errors gracefully
pool.on('connect', (client) => {
  // Set connection-level timeouts to prevent long-running transactions
  client.query('SET statement_timeout = 30000'); // 30 seconds
  client.query('SET idle_in_transaction_session_timeout = 600000'); // 10 minutes
});

export const db = drizzle(pool, { schema });
