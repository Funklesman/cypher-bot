const { 
    connectToMongoDB, 
    fetchDefiantRSS, 
    fetchCoinDeskRSS, 
    fetchCoinTelegraphRSS,
    analyzeArticleContent
} = require('./bot');

// Test all new sources
async function testNewSources() {
    console.log('🚀 Testing integration of new crypto news sources...\n');
    
    try {
        // Connect to MongoDB first
        await connectToMongoDB();
        
        // Test each source
        const defiantArticles = await fetchDefiantRSS();
        const coinDeskArticles = await fetchCoinDeskRSS();
        const coinTelegraphArticles = await fetchCoinTelegraphRSS();
        
        // Display results for each source
        await displaySourceResults('The Defiant', defiantArticles);
        await displaySourceResults('CoinDesk', coinDeskArticles);
        await displaySourceResults('CoinTelegraph', coinTelegraphArticles);
        
        // Show total
        const totalArticles = defiantArticles.length + coinDeskArticles.length + coinTelegraphArticles.length;
        console.log(`\n==================================================`);
        console.log(`✅ Successfully integrated ${totalArticles} articles from all sources`);
        console.log(`==================================================`);
        
    } catch (error) {
        console.error('❌ Error testing new sources:', error);
    }
}

// Display results for a single source
async function displaySourceResults(sourceName, articles) {
    console.log(`\n==================================================`);
    console.log(`📰 ${sourceName}: Found ${articles.length} articles`);
    console.log(`==================================================`);
    
    // Process each article
    for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        console.log(`\n📄 Article #${i + 1}: ${article.title}`);
        console.log(`📅 Published: ${article.publishedAt.toISOString()}`);
        console.log(`🔗 URL: ${article.url}`);
        
        // Analyze the content for crypto relevance
        console.log(`🔍 Analyzing crypto relevance and sentiment...`);
        const analysis = await analyzeArticleContent(article.title, article.description, article.source);
        
        console.log(`Crypto-relevant: ${analysis.isRelevant ? 'Yes ✅' : 'No ❌'}`);
        console.log(`Sentiment: ${analysis.sentiment}`);
    }
}

// Run the tests
testNewSources().catch(console.error); 