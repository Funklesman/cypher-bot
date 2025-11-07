require('dotenv').config();
const axios = require('axios');

async function checkDatabase() {
  const apiUrl = 'http://localhost:5001';
  
  try {
    console.log('Checking recent content...');
    const contentResponse = await axios.get(`${apiUrl}/api/content/recent?limit=5`);
    console.log('Recent content:');
    
    // Check for scores in content
    const contentData = contentResponse.data;
    console.log(`Found ${contentData.length} content records`);
    
    let hasScores = false;
    for (const item of contentData) {
      console.log(`\nArticle: ${item.title}`);
      console.log(`URL: ${item.url}`);
      console.log(`Prompt type: ${item.promptType}`);
      
      if (item.importanceScore !== undefined) {
        console.log(`👍 FOUND Importance Score: ${item.importanceScore}/10`);
        hasScores = true;
      } else {
        console.log(`❌ NO Importance Score found`);
      }
      
      if (item.urgencyScore !== undefined) {
        console.log(`👍 FOUND Urgency Score: ${item.urgencyScore}/10`);
        hasScores = true;
      } else {
        console.log(`❌ NO Urgency Score found`);
      }
    }
    
    if (!hasScores) {
      console.log('\n❌ No scores found in any content records');
    }
    
    // Try other endpoints
    console.log('\nChecking recent posts...');
    try {
      const postsResponse = await axios.get(`${apiUrl}/api/posts/recent?limit=5`);
      console.log('Recent posts:');
      
      // Check for scores in posts
      const postsData = postsResponse.data.posts;
      console.log(`Found ${postsData.length} post records`);
      
      let hasPostScores = false;
      for (const post of postsData) {
        console.log(`\nPost: ${post.title}`);
        console.log(`URL: ${post.url}`);
        console.log(`Prompt type: ${post.promptType}`);
        
        if (post.importanceScore !== undefined) {
          console.log(`👍 FOUND Importance Score: ${post.importanceScore}/10`);
          hasPostScores = true;
        } else {
          console.log(`❌ NO Importance Score found`);
        }
        
        if (post.urgencyScore !== undefined) {
          console.log(`👍 FOUND Urgency Score: ${post.urgencyScore}/10`);
          hasPostScores = true;
        } else {
          console.log(`❌ NO Urgency Score found`);
        }
      }
      
      if (!hasPostScores) {
        console.log('\n❌ No scores found in any post records');
      }
      
    } catch (err) {
      console.log('Could not fetch recent posts:', err.message);
    }
    
    // Check processed articles
    console.log('\nChecking processed articles...');
    try {
      const articlesResponse = await axios.get(`${apiUrl}/api/articles/recent?limit=5`);
      console.log(`Found ${articlesResponse.data.length} processed articles`);
      
      let hasArticleScores = false;
      for (const article of articlesResponse.data) {
        console.log(`\nProcessed article: ${article.title}`);
        console.log(`URL: ${article.url}`);
        
        if (article.importanceScore !== undefined) {
          console.log(`👍 FOUND Importance Score: ${article.importanceScore}/10`);
          hasArticleScores = true;
        } else {
          console.log(`❌ NO Importance Score found`);
        }
        
        if (article.urgencyScore !== undefined) {
          console.log(`👍 FOUND Urgency Score: ${article.urgencyScore}/10`);
          hasArticleScores = true;
        } else {
          console.log(`❌ NO Urgency Score found`);
        }
      }
      
      if (!hasArticleScores) {
        console.log('\n❌ No scores found in any processed articles');
      }
      
    } catch (err) {
      console.log('Could not fetch processed articles:', err.message);
    }
    
  } catch (error) {
    console.error('Error checking database:', error.message);
    if (error.response) {
      console.error('Error response:', error.response.data);
    }
  }
}

checkDatabase(); 