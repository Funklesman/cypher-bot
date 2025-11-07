/**
 * Minimal MongoDB connection test with step-by-step debugging
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testConnection() {
  console.log('Starting minimal MongoDB connection test...');
  
  // Print version info
  console.log(`MongoDB driver version: ${require('mongodb/package.json').version}`);
  console.log(`Node.js version: ${process.version}`);
  
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  console.log(`MongoDB URI: ${uri}`);
  
  // Create client with minimal options and short timeout
  console.log('Creating MongoDB client...');
  const client = new MongoClient(uri, {
    connectTimeoutMS: 3000,
    socketTimeoutMS: 3000,
    serverSelectionTimeoutMS: 3000
  });
  
  try {
    console.log('Attempting connection...');
    
    // Set timeout safety net
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout after 5 seconds')), 5000);
    });
    
    // Attempt connection with a timeout
    await Promise.race([
      client.connect(),
      timeoutPromise
    ]);
    
    console.log('Connection successful!');
    console.log('Closing connection...');
    await client.close();
    console.log('Connection closed.');
  } catch (error) {
    console.error(`Error connecting to MongoDB: ${error.message}`);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    
    // Check if it's a connection timeout
    if (error.message.includes('timeout')) {
      console.error('\nPossible reasons for timeout:');
      console.error('1. MongoDB server is not running at the specified URI');
      console.error('2. Firewall blocking the connection');
      console.error('3. MongoDB 8.0.6 compatibility issues with the driver');
      console.error('4. Authentication required but not provided');
    }
  } finally {
    try {
      // Force close if still connected
      await client.close(true);
    } catch (e) {
      // Ignore errors on close
    }
    console.log('Test completed.');
    process.exit(0); // Force exit
  }
}

// Execute with a global timeout
console.log('Starting test with a 10 second global timeout...');
setTimeout(() => {
  console.error('Global timeout reached. Process hanging. Forcing exit.');
  process.exit(1);
}, 10000);

testConnection(); 