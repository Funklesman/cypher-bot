/**
 * Create a minimal empty database for TweetBot
 */

const { MongoClient } = require('mongodb');

// Use lowercase database name for consistency
const DB_NAME = 'tweetbot';
const uri = 'mongodb://localhost:27017';

// Create client with explicit timeout
const client = new MongoClient(uri, {
  connectTimeoutMS: 5000,
  socketTimeoutMS: 5000,
  serverSelectionTimeoutMS: 5000
});

async function createEmptyDatabase() {
  console.log('Connecting to MongoDB...');
  
  try {
    await client.connect();
    console.log('Connected to MongoDB server');
    
    const db = client.db(DB_NAME);
    console.log(`Using database: ${DB_NAME}`);
    
    // Create the minimal collections needed
    console.log('Creating required collections...');
    
    // Create array of promises for collection creation
    const collectionPromises = [
      db.createCollection('articles'),
      db.createCollection('contentTest'),
      db.createCollection('postHistory'),
      db.createCollection('urgentNews')
    ];
    
    // Execute all promises in parallel
    await Promise.all(collectionPromises);
    
    console.log('Collections created successfully');
    
    // Create an index on the url field to ensure uniqueness
    console.log('Creating indexes...');
    await db.collection('articles').createIndex({ url: 1 }, { unique: true });
    
    console.log('Database setup complete. Empty database is ready for use.');
  } catch (err) {
    console.error(`Error creating database: ${err.message}`);
    console.error(err.stack);
  } finally {
    console.log('Closing connection');
    await client.close();
  }
}

// Run with a timeout to prevent hanging
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Operation timed out after 10 seconds')), 10000);
});

Promise.race([createEmptyDatabase(), timeoutPromise])
  .catch(error => {
    console.error(`Operation failed: ${error.message}`);
    process.exit(1);
  }); 