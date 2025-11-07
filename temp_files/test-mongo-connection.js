/**
 * Simple MongoDB connection test
 */

const { MongoClient } = require('mongodb');

async function testConnection() {
  console.log('Testing direct MongoDB connection...');
  
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  console.log(`Connecting to MongoDB at: ${uri}`);
  
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 5000
  });
  
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected to MongoDB!');
    
    const db = client.db('TweetBot');
    console.log('Connected to database');
    
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    collections.forEach(coll => console.log(` - ${coll.name}`));
    
    console.log('Connection test successful');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  } finally {
    await client.close();
    console.log('Connection closed');
  }
}

// Run the test
require('dotenv').config();
testConnection().then(() => process.exit(0)); 