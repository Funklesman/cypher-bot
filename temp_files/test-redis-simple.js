/**
 * Simple Redis Test (no connection)
 * Just instantiates Redis but doesn't connect
 */

console.log('Starting simple Redis test');

// Import Redis with a try-catch
try {
  const Redis = require('ioredis');
  console.log('Redis module imported successfully');
  
  // Create a Redis client but don't connect
  console.log('Creating Redis instance without connecting...');
  const redis = new Redis({
    lazyConnect: true, // Don't connect automatically
    host: 'localhost',
    port: 6379,
    maxRetriesPerRequest: 1,
  });
  
  console.log('Redis instance created successfully (not connected)');
  console.log('Test complete!');
  
  // Exit explicitly
  process.exit(0);
} catch (err) {
  console.error('Error:', err.message);
  console.error(err.stack);
  process.exit(1);
} 