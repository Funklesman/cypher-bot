/**
 * Simple MongoDB connection test with v4 driver
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function testConnection() {
  console.log('Testing MongoDB connection with v4 driver...');
  
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
  console.log(`MongoDB URI: ${uri}`);
  
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, 
    connectTimeoutMS: 5000
  });
  
  try {
    console.log('Connecting...');
    await client.connect();
    console.log('Connected to MongoDB!');
    
    const db = client.db('TweetBot');
    console.log(`Connected to database: ${db.databaseName}`);
    
    const collections = await db.listCollections().toArray();
    console.log(`Found ${collections.length} collections:`);
    collections.forEach(coll => console.log(` - ${coll.name}`));
    
    console.log('Connection test successful!');
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
  } finally {
    await client.close();
    console.log('Connection closed');
    process.exit(0);
  }
}

// Run the test
testConnection(); 