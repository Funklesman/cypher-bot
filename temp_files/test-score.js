require('dotenv').config();
const axios = require('axios');

async function testScoreTracking() {
  const apiUrl = 'http://localhost:5001';
  
  try {
    console.log('Creating test article with scores - testing all field name variations...');
    
    // Standard version with camelCase
    const testArticle1 = {
      url: `https://example.com/test-article-camel-${Date.now()}`,
      title: "Test Article with camelCase Score Tracking",
      source: "Test Source",
      description: "This is a test article to verify score tracking with camelCase",
      publishedAt: new Date().toISOString(),
      importanceScore: 8,
      urgencyScore: 9
    };
    
    // Version with lowercase
    const testArticle2 = {
      url: `https://example.com/test-article-lower-${Date.now()}`,
      title: "Test Article with lowercase Score Tracking",
      source: "Test Source", 
      description: "This is a test article to verify score tracking with lowercase",
      publishedAt: new Date().toISOString(),
      importancescore: 8,
      urgencyscore: 9
    };
    
    // Version with underscore
    const testArticle3 = {
      url: `https://example.com/test-article-underscore-${Date.now()}`,
      title: "Test Article with underscore Score Tracking",
      source: "Test Source",
      description: "This is a test article to verify score tracking with underscore",
      publishedAt: new Date().toISOString(),
      importance_score: 8,
      urgency_score: 9
    };
    
    // Version with just the number
    const testArticle4 = {
      url: `https://example.com/test-article-simple-${Date.now()}`,
      title: "Test Article with simple Score Tracking",
      source: "Test Source",
      description: "This is a test article to verify score tracking with simple names",
      publishedAt: new Date().toISOString(),
      importance: 8,
      urgency: 9
    };
    
    const testArticles = [testArticle1, testArticle2, testArticle3, testArticle4];
    
    for (const [index, article] of testArticles.entries()) {
      console.log(`\n=== TESTING ARTICLE ${index + 1} ===`);
      console.log('Article data:', JSON.stringify(article, null, 2));
      
      // 1. Mark it as processed
      console.log('\nMarking article as processed...');
      const processResult = await axios.post(`${apiUrl}/api/articles`, article);
      console.log('Result:', processResult.data);
      
      // 2. Store article content
      console.log('\nStoring article content...');
      const contentData = {
        article: article,
        content: `This is test content for article ${index + 1}`,
        promptType: "test-scores"
      };
      const contentResult = await axios.post(`${apiUrl}/api/content`, contentData);
      console.log('Content Result:', contentResult.data);
      
      // 3. Store post history
      console.log('\nStoring post history...');
      const postData = {
        article: article,
        content: `This is test post history content for article ${index + 1}`,
        postResult: { 
          id: `test-post-${Date.now()}`,
          url: `https://social.example.com/test-${Date.now()}`
        },
        promptType: "test-scores"
      };
      const postResult = await axios.post(`${apiUrl}/api/post-history`, postData);
      console.log('Post Result:', postResult.data);
    }
    
    // 4. Verify the scores are in the database
    console.log('\nChecking results...');
    await checkDatabase();
    
  } catch (error) {
    console.error('Error in test:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
  }
}

async function checkDatabase() {
  const apiUrl = 'http://localhost:5001';
  
  try {
    console.log('\nChecking recent content...');
    const contentResponse = await axios.get(`${apiUrl}/api/content/recent?limit=10`);
    const contentData = contentResponse.data;
    console.log(`Found ${contentData.length} content records`);
    
    let hasScores = false;
    for (const item of contentData) {
      if (item.title && item.title.includes("Score Tracking")) {
        console.log(`\nFound test article: ${item.title}`);
        console.log(`URL: ${item.url}`);
        
        // Check all possible score field names
        const scoreFields = [
          'importanceScore', 'urgencyScore',
          'importancescore', 'urgencyscore',
          'importance_score', 'urgency_score',
          'importance', 'urgency'
        ];
        
        for (const field of scoreFields) {
          if (item[field] !== undefined) {
            console.log(`✅ FOUND ${field}: ${item[field]}/10`);
            hasScores = true;
          }
        }
        
        if (!hasScores) {
          console.log(`❌ NO score fields found. All keys: ${Object.keys(item).join(', ')}`);
        }
      }
    }
    
    if (!hasScores) {
      console.log('\n❌ No scores found in test content records');
    }
    
    // Check posts as well
    console.log('\nChecking recent posts...');
    try {
      const postsResponse = await axios.get(`${apiUrl}/api/posts/recent?limit=10`);
      const postsData = postsResponse.data.posts;
      
      let hasPostScores = false;
      for (const post of postsData) {
        if (post.title && post.title.includes("Score Tracking")) {
          console.log(`\nFound test post: ${post.title}`);
          
          // Check all possible score field names
          const scoreFields = [
            'importanceScore', 'urgencyScore',
            'importancescore', 'urgencyscore',
            'importance_score', 'urgency_score',
            'importance', 'urgency'
          ];
          
          for (const field of scoreFields) {
            if (post[field] !== undefined) {
              console.log(`✅ FOUND ${field}: ${post[field]}/10`);
              hasPostScores = true;
            }
          }
          
          if (!hasPostScores) {
            console.log(`❌ NO score fields found. All keys: ${Object.keys(post).join(', ')}`);
          }
        }
      }
      
      if (!hasPostScores) {
        console.log('\n❌ No scores found in test post records');
      }
      
    } catch (err) {
      console.log('Could not fetch recent posts:', err.message);
    }
    
  } catch (error) {
    console.error('Error checking database:', error.message);
  }
}

// Run the test
testScoreTracking(); 