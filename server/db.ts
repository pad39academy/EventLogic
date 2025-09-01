import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";

<<<<<<< HEAD
const { Pool } = pg;
=======
// Configure Neon for serverless environment
neonConfig.webSocketConstructor = ws;
>>>>>>> 46e143b452e019a2e6d60cfdc85100a13f24e5e1

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

<<<<<<< HEAD
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const db = drizzle(pool, { schema });
=======
// Create connection pool with proper error handling
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Add error handling for pool connection issues
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

export const db = drizzle({ client: pool, schema });
>>>>>>> 46e143b452e019a2e6d60cfdc85100a13f24e5e1
