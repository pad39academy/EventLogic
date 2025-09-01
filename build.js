import { build } from 'esbuild';
import { execSync } from 'child_process';

// First build the frontend
console.log('Building frontend...');
execSync('vite build', { stdio: 'inherit' });

// Then build the backend with proper externals
console.log('Building backend...');

const nodeBuiltins = [
  'util', 'crypto', 'fs', 'path', 'stream', 'events', 'buffer', 
  'url', 'querystring', 'http', 'https', 'net', 'tls', 'os', 
  'zlib', 'assert', 'timers', 'child_process', 'readline',
  'string_decoder', 'punycode', 'dns', 'cluster', 'dgram',
  'repl', 'vm', 'constants', 'process', 'module'
];

try {
  await build({
    entryPoints: ['server/index.ts', 'viteDev.ts', 'viteProd.ts'],
    platform: 'node',
    format: 'esm',
    bundle: true,
    outdir: 'dist',
    packages: 'external',
    external: [...nodeBuiltins],
    target: 'node20',
    minify: false,
    sourcemap: false,
    banner: {
      js: 'import { createRequire } from "module"; const require = createRequire(import.meta.url);'
    }
  });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
