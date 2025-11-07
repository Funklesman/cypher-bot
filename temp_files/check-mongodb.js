/**
 * Direct MongoDB check
 * 
 * This script directly connects to MongoDB to check collections
 */

const { MongoClient } = require('mongodb');

// MongoDB connection string
const uri = 'mongodb://localhost:27017';
const dbName = 'tweetbot';

async function checkDb() {
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📊 Collections in the database:');
    collections.forEach(collection => {
      console.log(`  - ${collection.name}`);
    });
    
    // Check intents collection
    const intentsCollection = db.collection('processing_intents');
    const intents = await intentsCollection.find({}).toArray();
    
    console.log('\n📊 Contents of processing_intents collection:');
    if (intents.length === 0) {
      console.log('  No documents found in processing_intents collection');
    } else {
      intents.forEach(intent => {
        console.log(`  - URL: ${intent.url}`);
        console.log(`    Type: ${intent.processing_type}`);
        console.log(`    Created: ${intent.created_at}`);
        console.log(`    Expires: ${intent.expires_at}`);
        console.log('');
      });
    }
    
    // Check if our TTL index is set up
    const indexes = await intentsCollection.indexes();
    console.log('\n📊 Indexes on processing_intents collection:');
    indexes.forEach(index => {
      console.log(`  - ${JSON.stringify(index)}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.close();
  }
}

checkDb(); 