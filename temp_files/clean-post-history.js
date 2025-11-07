#!/usr/bin/env node

/**
 * Clean post history duplicates
 * 
 * This script removes duplicate entries in the post_history collection
 * where there's both a successful and unsuccessful entry for the same article
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

// MongoDB connection string
const mongoUri = process.env.MONGO_URL || 'mongodb://localhost:27017/twitterbot';

async function cleanPostHistory() {
  const client = new MongoClient(mongoUri);
  
  try {
    console.log('🧹 Cleaning post history duplicates...');
    await client.connect();
    
    const db = client.db();
    const collection = db.collection('post_history');
    
    // Get all URLs in the collection
    const urls = await collection.distinct('url');
    console.log(`Found ${urls.length} unique URLs in post history`);
    
    let duplicatesRemoved = 0;
    
    // For each URL, check if there are duplicates
    for (const url of urls) {
      // Find all entries for this URL
      const entries = await collection.find({ url }).toArray();
      
      if (entries.length > 1) {
        console.log(`\nFound ${entries.length} entries for URL: ${url}`);
        
        // Check if there's a successful post
        const successfulPost = entries.find(entry => entry.postSuccess === true);
        
        if (successfulPost) {
          // Get IDs of unsuccessful posts
          const unsuccessfulIds = entries
            .filter(entry => entry.postSuccess === false)
            .map(entry => entry._id);
          
          if (unsuccessfulIds.length > 0) {
            // Delete unsuccessful posts
            const deleteResult = await collection.deleteMany({ 
              _id: { $in: unsuccessfulIds } 
            });
            
            console.log(`✅ Deleted ${deleteResult.deletedCount} unsuccessful duplicates for: ${successfulPost.title}`);
            duplicatesRemoved += deleteResult.deletedCount;
          }
        }
      }
    }
    
    console.log(`\n🎉 Clean-up complete! Removed ${duplicatesRemoved} duplicate entries.`);
    
  } catch (error) {
    console.error('Error cleaning post history:', error);
  } finally {
    await client.close();
  }
}

// Run the function
cleanPostHistory(); 