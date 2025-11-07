const { MongoClient } = require('mongodb');
require('dotenv').config();

async function clearTodaysProcessed() {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const db = client.db('TweetBot');
    
    // Get today's date at midnight UTC
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    
    console.log(`Clearing processedArticles from: ${today.toISOString()}`);
    
    // Find and show what we're about to delete
    const toDelete = await db.collection('processedArticles')
        .find({ processedAt: { $gte: today } })
        .toArray();
    
    console.log(`\n📰 Found ${toDelete.length} articles from today:`);
    toDelete.forEach(p => {
        console.log(`  - ${p.title?.substring(0, 60)}...`);
    });
    
    if (toDelete.length > 0) {
        const result = await db.collection('processedArticles')
            .deleteMany({ processedAt: { $gte: today } });
        console.log(`\n✅ Deleted ${result.deletedCount} articles from today`);
    } else {
        console.log('\n✅ No articles from today to delete');
    }
    
    await client.close();
}

clearTodaysProcessed().catch(console.error);

