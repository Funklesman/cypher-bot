const { MongoClient } = require('mongodb');
require('dotenv').config();

async function checkCollections() {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    const db = client.db('TweetBot');
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📚 Collections in TweetBot database:');
    for (const coll of collections) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`  - ${coll.name}: ${count} documents`);
    }
    
    // Check processedArticles specifically
    const processed = await db.collection('processedArticles')
        .find({})
        .sort({ processedAt: -1 })
        .limit(5)
        .toArray();
    
    console.log('\n📰 Recent processedArticles (last 5):');
    processed.forEach(p => {
        console.log(`  - ${p.title?.substring(0, 50)}... (${new Date(p.processedAt).toISOString()})`);
    });
    
    await client.close();
}

checkCollections().catch(console.error);
