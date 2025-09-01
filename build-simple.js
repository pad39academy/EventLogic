import { build } from 'esbuild';
import { execSync } from 'child_process';
console.log('Building frontend...');
execSync('vite build', { stdio: 'inherit' });
console.log('Building backend...');
try {
  await build({
    entryPoints: ['server/index.ts'],
    platform: 'node',
    format: 'esm',
    bundle: true,
    outfile: 'dist/server/index.js',
    packages: 'external',
    external: [
      // Database packages - don't bundle these at all
      'pg', '@neondatabase/serverless', 'postgres', 'drizzle-orm',
      // Express packages  
      'express', 'express-session', 'multer', 'passport', 'passport-local',
      'connect-pg-simple', 'bcryptjs',
      // All Node.js built-ins
      'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns', 
      'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'querystring', 
      'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 
      'tty', 'url', 'util', 'vm', 'zlib', 'constants', 'module', 'process'
    ],
    target: 'node18',
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);'
    }
  });
  
  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error);
  process.exit(1);
}
