/**
 * Update Urgent Flags Script
 * 
 * This script updates existing articles in the processedArticles collection
 * to set the isUrgent flag based on importanceScore.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection settings
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'TweetBot';
const URGENCY_THRESHOLD = 7;

async function updateUrgentFlags() {
  console.log('🔄 Starting update of urgent flags based on importance scores...');
  
  const client = new MongoClient(mongoUri);
  
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);
    const articlesCollection = db.collection('processedArticles');
    
    // Find articles with high importance but not marked as urgent
    const articlesToUpdate = await articlesCollection.find({
      $or: [
        { importanceScore: { $gte: URGENCY_THRESHOLD }, isUrgent: { $ne: true } },
        { importanceScore: { $gte: URGENCY_THRESHOLD }, isUrgent: { $exists: false } }
      ]
    }).toArray();
    
    console.log(`📊 Found ${articlesToUpdate.length} articles with high importance scores that need urgent flag update`);
    
    if (articlesToUpdate.length === 0) {
      console.log('✅ No articles to update');
      return;
    }
    
    // Update each article
    let updated = 0;
    
    for (const article of articlesToUpdate) {
      try {
        const result = await articlesCollection.updateOne(
          { _id: article._id },
          { $set: { isUrgent: true } }
        );
        
        if (result.modifiedCount > 0) {
          console.log(`✅ Updated article: ${article.title} (Score: ${article.importanceScore}/10)`);
          updated++;
        } else {
          console.log(`⚠️ No changes made to article: ${article.title}`);
        }
      } catch (error) {
        console.error(`❌ Error updating article ${article.title}:`, error);
      }
    }
    
    console.log(`\n🔄 Update complete!`);
    console.log(`✅ Successfully updated ${updated} articles`);
    
  } catch (error) {
    console.error('❌ Error updating urgent flags:', error);
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the update
updateUrgentFlags(); 