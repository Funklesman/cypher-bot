const { MongoClient } = require('mongodb');
require('dotenv').config();

async function clearTestPosts() {
    console.log('Connecting to MongoDB...');
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    
    const db = client.db('TweetBot');
    
    // Clear ALL posts from today
    const result = await db.collection('post_history').deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount} total posts`);
    
    await client.close();
}

clearTestPosts().catch(console.error);

