/**
 * Test Redis Import Only
 */

console.log('Starting Redis import test');

// Just try to import the module
console.log('Importing Redis...');
const Redis = require('ioredis');
console.log('Redis module imported successfully');

// Import but don't instantiate
console.log('Redis module version:', Redis.version || 'unknown');
console.log('Test complete successfully!'); 