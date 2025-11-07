/**
 * Check TweetBot Database Contents
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = 'TweetBot'; // Use the exact capitalization from the backup

// Use a modern client configuration without deprecated options
const client = new MongoClient(MONGODB_URI, {
  connectTimeoutMS: 10000,
  socketTimeoutMS: 10000,
  serverSelectionTimeoutMS: 10000
});

async function run() {
  try {
    console.log(`Connecting to MongoDB at ${MONGODB_URI}...`);
    await client.connect();
    console.log('✅ Successfully connected to MongoDB');
    
    // Get list of all databases to verify our TweetBot DB is there
    const adminDb = client.db('admin');
    const dbList = await adminDb.admin().listDatabases();
    console.log('\n📋 Available databases:');
    dbList.databases.forEach(db => console.log(`- ${db.name}`));
    
    // Use the database with correct case
    const db = client.db(DB_NAME);
    console.log(`\n✅ Connected to database: ${DB_NAME}`);
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log(`\n📋 Collections in database (${collections.length} total):`);
    collections.forEach(coll => console.log(`- ${coll.name}`));
    
    // For each collection, count the documents
    console.log('\n📊 Document counts:');
    for (const coll of collections) {
      const count = await db.collection(coll.name).countDocuments();
      console.log(`- ${coll.name}: ${count} documents`);
    }
    
    // Check for specific collections we need based on the backup files
    const expectedCollections = [
      'contentTest', 'post_history', 'processedArticles', 'processing_intents'
    ];
    
    console.log('\n🔍 Checking for expected collections:');
    const collNames = collections.map(c => c.name);
    for (const expected of expectedCollections) {
      if (collNames.includes(expected)) {
        const count = await db.collection(expected).countDocuments();
        console.log(`✅ ${expected}: Found (${count} documents)`);
      } else {
        console.log(`❌ ${expected}: Missing`);
      }
    }
    
    // If the processedArticles collection exists, check a sample document
    if (collNames.includes('processedArticles')) {
      console.log('\n📝 Sample processed article document:');
      const sample = await db.collection('processedArticles').findOne({});
      
      if (sample) {
        // Print a sanitized version of the document
        console.log(JSON.stringify({
          _id: sample._id.toString(),
          title: sample.title || 'N/A',
          url: sample.url || 'N/A',
          source: sample.source || 'N/A',
          processedAt: sample.processedAt || 'N/A'
        }, null, 2));
      } else {
        console.log('No documents found in processedArticles collection');
      }
    }
    
    // Close the client
    await client.close();
    console.log('\n✅ Database check complete');
  } catch (err) {
    console.error(`❌ Error: ${err.message}`);
    console.error(err.stack);
  } finally {
    try {
      await client.close();
    } catch (error) {
      // Ignore close errors
    }
  }
}

// Run the database check
run(); 