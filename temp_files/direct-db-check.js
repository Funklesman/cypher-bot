require('dotenv').config();
const { MongoClient } = require('mongodb');

// Connection URL
const url = process.env.MONGO_URI || 'mongodb://localhost:27017';
const client = new MongoClient(url);

async function directDbCheck() {
  try {
    // Connect to the MongoDB server
    await client.connect();
    console.log('Connected to MongoDB server');
    
    // List all databases
    const adminDb = client.db('admin');
    const dbs = await adminDb.admin().listDatabases();
    
    console.log('\n=== AVAILABLE DATABASES ===');
    for (const db of dbs.databases) {
      console.log(` - ${db.name} (${db.sizeOnDisk} bytes)`);
    }
    
    // Check each database for our collections
    for (const dbInfo of dbs.databases) {
      const dbName = dbInfo.name;
      if (dbName === 'admin' || dbName === 'local' || dbName === 'config') {
        continue; // Skip system databases
      }
      
      console.log(`\n\n=== CHECKING DATABASE: ${dbName} ===`);
      const db = client.db(dbName);
      
      // List all collections in this database
      const collections = await db.listCollections().toArray();
      console.log(`\nCollections in ${dbName}:`);
      collections.forEach(coll => {
        console.log(` - ${coll.name}`);
      });
      
      // Check each collection that might contain our articles
      const possibleCollections = ['processedArticles', 'contentTest', 'post_history'];
      
      for (const collName of possibleCollections) {
        if (collections.some(c => c.name === collName)) {
          console.log(`\n--- CHECKING ${collName} in ${dbName} ---`);
          const collection = db.collection(collName);
          
          // First check if there are any documents with test-article in the URL
          const testArticles = await collection.find({
            url: { $regex: /test-article/ }
          }).toArray();
          
          console.log(`Found ${testArticles.length} test articles in ${collName}`);
          
          if (testArticles.length > 0) {
            // Display details for each test article
            for (const article of testArticles) {
              console.log(`\nArticle: ${article.title || 'No title'}`);
              console.log(`URL: ${article.url}`);
              console.log(`Keys in document: ${Object.keys(article).join(', ')}`);
              
              if ('importanceScore' in article) {
                console.log(`✅ Importance Score: ${article.importanceScore}`);
              } else {
                console.log(`❌ NO Importance Score found`);
              }
              
              if ('urgencyScore' in article) {
                console.log(`✅ Urgency Score: ${article.urgencyScore}`);
              } else {
                console.log(`❌ NO Urgency Score found`);
              }
            }
          }
        }
      }
    }
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    // Close the connection
    await client.close();
    console.log('\nMongoDB connection closed');
  }
}

// Run the check
directDbCheck().catch(console.error); 