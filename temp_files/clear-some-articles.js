/**
 * Clear Some Articles Script
 * 
 * This script clears articles from the processedArticles collection
 * that don't have importance scores, allowing them to be reprocessed.
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

async function clearSomeArticles() {
  const client = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017');
  
  try {
    await client.connect();
    const db = client.db('TweetBot');
    const collection = db.collection('processedArticles');
    
    // Get count before deletion
    const countBefore = await collection.countDocuments();
    console.log(`Total articles before: ${countBefore}`);
    
    // Delete the 20 most recent articles without importance score
    const result = await collection.deleteMany({
      $or: [
        { importanceScore: { $exists: false } },
        { importanceScore: null }
      ]
    }, { 
      sort: { processedAt: -1 }, // Sort by most recent first
      limit: 20                  // Take only 20
    });
    
    console.log(`Deleted ${result.deletedCount} articles`);
    
    // Get count after deletion
    const countAfter = await collection.countDocuments();
    console.log(`Total articles after: ${countAfter}`);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

clearSomeArticles(); 