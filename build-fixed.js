import { build } from 'esbuild';
import { execSync } from 'child_process';
// Build frontend first
console.log('Building frontend...');
execSync('vite build', { stdio: 'inherit' });
// Build backend with proper externals
console.log('Building backend...');
const nodeBuiltins = [
  'assert', 'buffer', 'child_process', 'cluster', 'crypto', 'dgram', 'dns', 
  'events', 'fs', 'http', 'https', 'net', 'os', 'path', 'querystring', 
  'readline', 'repl', 'stream', 'string_decoder', 'timers', 'tls', 
  'tty', 'url', 'util', 'vm', 'zlib', 'constants', 'module', 'process'
];
try {
  await build({
    entryPoints: ['server/index.ts'],
    platform: 'node',
    format: 'esm',
    bundle: true,
    outfile: 'dist/server/index.js',
    packages: 'external',
    external: [...nodeBuiltins, 'express', 'body-parser', 'express-session'],
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
