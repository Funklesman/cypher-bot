/**
 * Test with only built-in Node.js modules
 * No npm packages at all
 */

console.log('Starting test with built-in modules only');

// Use a few built-in modules
const fs = require('fs');
const path = require('path');
const os = require('os');

// Display some system info
console.log('Current directory:', process.cwd());
console.log('Node.js version:', process.version);
console.log('Platform:', process.platform);
console.log('OS type:', os.type());
console.log('OS release:', os.release());
console.log('CPU architecture:', os.arch());
console.log('Available memory:', os.totalmem() / 1024 / 1024 / 1024, 'GB');

// Try to read package.json
try {
  const packageJson = fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8');
  const pkg = JSON.parse(packageJson);
  console.log('Package name:', pkg.name);
  console.log('Dependencies:', Object.keys(pkg.dependencies).length);
} catch (err) {
  console.error('Error reading package.json:', err.message);
}

console.log('Built-in modules test completed successfully!'); 