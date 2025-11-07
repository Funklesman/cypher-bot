const { MongoClient } = require('mongodb');
require('dotenv').config();

const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'TweetBot';

async function initDatabase() {
  try {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(mongoUri);
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);
    
    // Create the processedArticles collection with indexes
    const articlesCollection = db.collection('processedArticles');
    // Unique index on url to prevent duplicates
    await articlesCollection.createIndex({ url: 1 }, { unique: true });
    // Index on publishedAt for sorting by date
    await articlesCollection.createIndex({ publishedAt: -1 });
    console.log('✅ Created processedArticles collection with indexes');
    
    // Create the post_history collection to track posting stats
    const historyCollection = db.collection('post_history');
    await historyCollection.createIndex({ postedAt: 1 });
    console.log('✅ Created post_history collection with postedAt index');
    
    console.log('✅ Database initialization complete!');
    await client.close();
  } catch (error) {
    console.error('❌ Error initializing database:', error);
  }
}

// Run the initialization
initDatabase().catch(console.error); 