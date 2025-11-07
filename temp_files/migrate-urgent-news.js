/**
 * Migration Script: Move urgentNews to processedArticles
 * 
 * This script migrates data from the deprecated urgentNews collection
 * to the processedArticles collection, setting the isUrgent flag.
 */

const { MongoClient } = require('mongodb');
require('dotenv').config();

// MongoDB connection settings
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'TweetBot';

async function migrateUrgentNews() {
  console.log('🔄 Starting migration of urgent news data...');
  
  const client = new MongoClient(mongoUri);
  
  try {
    // Connect to MongoDB
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db(dbName);
    const urgentNewsCollection = db.collection('urgentNews');
    const processedArticlesCollection = db.collection('processedArticles');
    
    // Check if urgentNews collection exists
    const collections = await db.listCollections({name: 'urgentNews'}).toArray();
    if (collections.length === 0) {
      console.log('⚠️ urgentNews collection does not exist. Nothing to migrate.');
      return;
    }
    
    // Get all documents from urgentNews collection
    const urgentNews = await urgentNewsCollection.find({}).toArray();
    console.log(`📊 Found ${urgentNews.length} documents in urgentNews collection`);
    
    // Process each document
    let migrated = 0;
    let skipped = 0;
    
    for (const article of urgentNews) {
      // Check if the article already exists in processedArticles
      const existingArticle = await processedArticlesCollection.findOne({url: article.url});
      
      if (existingArticle) {
        // Update existing document to mark it as urgent
        await processedArticlesCollection.updateOne(
          { url: article.url },
          { 
            $set: { 
              isUrgent: true,
              // Set urgencyScore if it doesn't exist
              ...(existingArticle.urgencyScore ? {} : { urgencyScore: article.urgencyScore || 8 })
            }
          }
        );
        console.log(`🔄 Updated existing article as urgent: ${article.title}`);
        migrated++;
      } else {
        // Create new document in processedArticles
        try {
          await processedArticlesCollection.insertOne({
            url: article.url,
            title: article.title,
            source: article.source,
            description: article.description || '',
            publishedAt: article.publishedAt || new Date(),
            processedAt: article.processedAt || new Date(),
            isUrgent: true,
            urgencyScore: article.urgencyScore || 8,
            justification: article.justification || 'Migrated from urgentNews collection'
          });
          console.log(`✅ Migrated urgent article: ${article.title}`);
          migrated++;
        } catch (error) {
          console.error(`❌ Error migrating article: ${article.title}`, error);
          skipped++;
        }
      }
    }
    
    console.log(`\n🔄 Migration complete!`);
    console.log(`✅ Successfully migrated/updated ${migrated} articles`);
    console.log(`⚠️ Skipped ${skipped} articles due to errors`);
    
    // Check if we should drop the original collection
    if (migrated > 0 && skipped === 0) {
      const dropConfirmation = process.argv.includes('--drop');
      
      if (dropConfirmation) {
        console.log('\n🚮 Dropping the urgentNews collection...');
        await urgentNewsCollection.drop();
        console.log('✅ Dropped urgentNews collection');
      } else {
        console.log('\n⚠️ The urgentNews collection was not dropped.');
        console.log('To drop it, run this script with the --drop flag: node migrate-urgent-news.js --drop');
      }
    } else if (skipped > 0) {
      console.log('\n⚠️ Some articles were skipped. The urgentNews collection was preserved.');
      console.log('Fix the errors and try again before dropping the collection.');
    }
    
  } catch (error) {
    console.error('❌ Error in migration:', error);
  } finally {
    await client.close();
    console.log('👋 Disconnected from MongoDB');
  }
}

// Run the migration
migrateUrgentNews(); 