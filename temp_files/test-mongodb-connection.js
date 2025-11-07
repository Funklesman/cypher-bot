/**
 * Minimal MongoDB connection test
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'tweetbot';

// Set a reasonable timeout
const TIMEOUT_MS = 10000;

console.log(`Testing MongoDB connection to: ${MONGODB_URI}`);
console.log(`Database name: ${DB_NAME}`);
console.log(`Connection timeout: ${TIMEOUT_MS}ms`);

// Create a client with explicit timeout options
const client = new MongoClient(MONGODB_URI, {
  connectTimeoutMS: TIMEOUT_MS,
  socketTimeoutMS: TIMEOUT_MS,
  serverSelectionTimeoutMS: TIMEOUT_MS,
  // Other options to help with connection issues
  useNewUrlParser: true,
  useUnifiedTopology: true
});

// Connection promise with timeout
const connectWithTimeout = () => {
  return Promise.race([
    client.connect(),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Connection timed out after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
    )
  ]);
};

// Main async function
async function run() {
  try {
    console.log('Attempting to connect to MongoDB...');
    await connectWithTimeout();
    console.log('✅ Successfully connected to MongoDB');
    
    // Try to access a collection
    const db = client.db(DB_NAME);
    console.log('✅ Successfully connected to database');
    
    // List collections
    const collections = await db.listCollections().toArray();
    console.log(`✅ Collections in database: ${collections.map(c => c.name).join(', ') || 'none'}`);
    
    // Close the connection
    await client.close();
    console.log('✅ Connection closed successfully');
  } catch (err) {
    console.error(`❌ MongoDB connection error: ${err.message}`);
    console.error(`Stack trace: ${err.stack}`);
    
    // Check for specific errors
    if (err.message.includes('ECONNREFUSED')) {
      console.error('💡 MongoDB server is not running or not accessible at the specified URI');
    } else if (err.message.includes('Authentication failed')) {
      console.error('💡 MongoDB authentication failed - check username/password in connection string');
    } else if (err.message.includes('timed out')) {
      console.error('💡 Connection timed out - MongoDB server might be too busy or unreachable');
    }
    
    try {
      await client.close();
    } catch (closeErr) {
      // Ignore close errors
    }
  }
}

// Run the test
run(); 