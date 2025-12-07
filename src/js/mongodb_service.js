/**
 * MongoDB Service for TweetBot
 * 
 * Direct MongoDB implementation to replace the Python bridge.
 * This service provides all the same functionality as the Python MongoDB service.
 */

const { MongoClient, ObjectId } = require('mongodb');
const { DateTime } = require('luxon');

class MongoDBService {
  constructor(mongoUri = null) {
    console.log('Initializing MongoDBService...');
    this.mongoUri = mongoUri || process.env.MONGO_URI || 'mongodb://localhost:27017';
    console.log(`MongoDB URI: ${this.mongoUri}`);
    this.dbName = 'TweetBot';
    this.client = null;
    this.db = null;
    this.collections = {};
  }

  /**
   * Connect to MongoDB and initialize all collections
   * @returns {Promise<boolean>} - True if connection successful
   */
  async connect() {
    try {
      console.log('Attempting to connect to MongoDB...');
      this.client = new MongoClient(this.mongoUri, {
        serverSelectionTimeoutMS: 5000, // 5 second timeout
        connectTimeoutMS: 5000
      });
      console.log('Created MongoDB client, connecting...');
      
      // Connect with timeout
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 5000)
      );
      
      await Promise.race([connectPromise, timeoutPromise]);
      console.log('Connected to MongoDB server');
      
      this.db = this.client.db(this.dbName);
      console.log(`Connected to database: ${this.dbName}`);
      
      // Initialize all collections
      this.collections = {
        content: this.db.collection('contentTest'),
        postHistory: this.db.collection('post_history'),
        processingIntents: this.db.collection('processing_intents')
      };
      console.log('Initialized collections');
      
      // Create indexes
      console.log('Creating indexes...');
      await this.createIndexes();
      
      console.log('✅ Connected to MongoDB and initialized all collections');
      return true;
    } catch (error) {
      console.error(`❌ Error connecting to MongoDB: ${error.message}`);
      return false;
    }
  }

  /**
   * Create necessary indexes for all collections
   * @returns {Promise<boolean>} - True if indexes created successfully
   */
  async createIndexes() {
    try {
      // Create a unique index on the url field to prevent duplicate entries
      await this.collections.content.createIndex({ url: 1 }, { unique: true });
      await this.collections.postHistory.createIndex({ url: 1 }); // Not unique since we can have main post + diary candidates
      
      // Create an index on the url field for processing intents
      await this.collections.processingIntents.createIndex({ url: 1 }, { unique: true });
      
      // Create a TTL index on the expires_at field to automatically delete old intents
      await this.collections.processingIntents.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });
      
      // Add indexes for importance and urgency scores for faster queries
      await this.collections.content.createIndex({ importanceScore: -1 });
      await this.collections.content.createIndex({ urgencyScore: -1 });
      await this.collections.postHistory.createIndex({ importanceScore: -1 });
      await this.collections.postHistory.createIndex({ urgencyScore: -1 });
      await this.collections.postHistory.createIndex({ postedAt: -1 }); // For diary date range queries
      await this.collections.postHistory.createIndex({ publishedAt: -1 }); // For article recency
      
      console.log('✅ Created all indexes');
      return true;
    } catch (error) {
      console.error(`❌ Error creating indexes: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if an article has been processed already by looking in post_history
   * @param {string} url - Article URL
   * @returns {Promise<boolean>} - True if the article has been processed
   */
  async isArticleProcessed(url) {
    if (!this.collections.postHistory) {
      return false;
    }
    
    try {
      const existingArticle = await this.collections.postHistory.findOne({ url });
      return Boolean(existingArticle);
    } catch (error) {
      console.error(`❌ Error checking if article was processed: ${error.message}`);
      return false;
    }
  }

  /**
   * REMOVED: markArticleAsProcessed function - no longer needed
   * Articles are now tracked automatically in post_history collection
   * Deduplication uses isArticleProcessed() which checks post_history
   */
  /* async markArticleAsProcessed(article) {
    try {
      // Create an article object
      const doc = {
        url: article.url,
        title: article.title,
        source: article.source,
        description: article.description || '',
        processedAt: new Date()
      };
      
      // Check all possible score field variations
      // Standard camelCase
      if ('importanceScore' in article) {
        doc.importanceScore = article.importanceScore;
        console.log(`📊 Storing camelCase importance score: ${article.importanceScore}/10`);
      } else if ('importancescore' in article) {  // lowercase
        doc.importanceScore = article.importancescore;
        console.log(`📊 Converting lowercase importance score: ${article.importancescore}/10`);
      } else if ('importance_score' in article) {  // underscore
        doc.importanceScore = article.importance_score;
        console.log(`📊 Converting underscore importance score: ${article.importance_score}/10`);
      } else if ('importance' in article) {  // simple
        doc.importanceScore = article.importance;
        console.log(`📊 Converting simple importance: ${article.importance}/10`);
      }
          
      // Standard camelCase for urgency
      let urgencyValue = null;
      if ('urgencyScore' in article) {
        urgencyValue = article.urgencyScore;
        doc.urgencyScore = urgencyValue;
        console.log(`🚨 Storing camelCase urgency score: ${urgencyValue}/10`);
      } else if ('urgencyscore' in article) {  // lowercase
        urgencyValue = article.urgencyscore;
        doc.urgencyScore = urgencyValue;
        console.log(`🚨 Converting lowercase urgency score: ${urgencyValue}/10`);
      } else if ('urgency_score' in article) {  // underscore
        urgencyValue = article.urgency_score;
        doc.urgencyScore = urgencyValue;
        console.log(`🚨 Converting underscore urgency score: ${urgencyValue}/10`);
      } else if ('urgency' in article) {  // simple
        urgencyValue = article.urgency;
        doc.urgencyScore = urgencyValue;
        console.log(`🚨 Converting simple urgency: ${urgencyValue}/10`);
      }
      
      // Add isUrgent flag based on urgency threshold or keywords
      // Default urgency threshold is 7
      const urgencyThreshold = 7;
      doc.isUrgent = false;
      
      // Check if urgency score is above threshold
      if (urgencyValue !== null && urgencyValue >= urgencyThreshold) {
        doc.isUrgent = true;
        console.log(`🚨 Article marked as URGENT based on urgency score: ${urgencyValue}/10`);
      }
      // If no urgency score but importance score is high, use that
      else if ('importanceScore' in doc && doc.importanceScore >= urgencyThreshold) {
        doc.isUrgent = true;
        console.log(`🚨 Article marked as URGENT based on importance score: ${doc.importanceScore}/10`);
      }
      // Also check title for urgent keywords if no score was found
      else if (urgencyValue === null && article.title) {
        // Keywords that indicate urgency
        const urgentKeywords = [
          'hack', 'exploit', 'vulnerability', 'attack', 'stolen', 'theft', 'crash',
          'collapse', 'plunge', 'emergency', 'critical', 'urgent', 'breaking',
          'halted', 'suspended', 'SEC charges', 'fraud', 'investigation', 'lawsuit',
          'security breach', 'major loss'
        ];
        
        // Check if title contains any urgent keywords
        const isUrgent = urgentKeywords.some(keyword => 
          article.title.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (isUrgent) {
          doc.isUrgent = true;
          console.log(`🚨 Article marked as URGENT based on keywords: ${article.title}`);
        }
      }
      
      // Add publishedAt if available
      if ('publishedAt' in article) {
        // Convert string to datetime if needed
        if (typeof article.publishedAt === 'string') {
          try {
            doc.publishedAt = new Date(article.publishedAt);
          } catch(e) {
            doc.publishedAt = new Date();
          }
        } else {
          doc.publishedAt = article.publishedAt;
        }
      }
      
      // Insert the article into the collection
      const result = await this.collections.articles.insertOne(doc);
      
      if (result.insertedId) {
        console.log(`✅ Marked article as processed: ${article.title}`);
        if ('importanceScore' in doc) {
          console.log(`📊 Stored importance score: ${doc.importanceScore}/10`);
        }
        if ('urgencyScore' in doc) {
          console.log(`🚨 Stored urgency score: ${doc.urgencyScore}/10`); 
        }
        if (doc.isUrgent) {
          console.log(`🚨 Article stored with isUrgent=True flag`);
        }
        return true;
      } else {
        console.error(`❌ Failed to mark article as processed: ${article.title}`);
        return false;
      }
          
    } catch (error) {
      console.error(`❌ Error marking article as processed: ${error.message}`);
      return false;
    }
  } */

  /**
   * Store article content in the contentTest collection
   * @param {Object} article - Article object
   * @param {string} content - Generated content
   * @param {string} promptType - Type of prompt used (e.g. positive-variation-1)
   * @returns {Promise<boolean>} - True if successful
   */
  async storeArticleContent(article, content, promptType = 'unknown') {
    try {
      // Create content object
      const contentObj = {
        url: article.url,
        title: article.title,
        source: article.source,
        description: article.description || '',
        content: content,
        promptType: promptType,  // Store the prompt type
        generatedAt: new Date()
      };
      
      // Check all possible score field variations
      // Standard camelCase
      if ('importanceScore' in article) {
        contentObj.importanceScore = article.importanceScore;
        console.log(`📊 Storing camelCase importance score in content: ${article.importanceScore}/10`);
      } else if ('importancescore' in article) {  // lowercase
        contentObj.importanceScore = article.importancescore;
        console.log(`📊 Converting lowercase importance score in content: ${article.importancescore}/10`);
      } else if ('importance_score' in article) {  // underscore
        contentObj.importanceScore = article.importance_score;
        console.log(`📊 Converting underscore importance score in content: ${article.importance_score}/10`);
      } else if ('importance' in article) {  // simple
        contentObj.importanceScore = article.importance;
        console.log(`📊 Converting simple importance in content: ${article.importance}/10`);
      }
          
      // Standard camelCase for urgency
      if ('urgencyScore' in article) {
        contentObj.urgencyScore = article.urgencyScore;
        console.log(`🚨 Storing camelCase urgency score in content: ${article.urgencyScore}/10`);
      } else if ('urgencyscore' in article) {  // lowercase
        contentObj.urgencyScore = article.urgencyscore;
        console.log(`🚨 Converting lowercase urgency score in content: ${article.urgencyscore}/10`);
      } else if ('urgency_score' in article) {  // underscore
        contentObj.urgencyScore = article.urgency_score;
        console.log(`🚨 Converting underscore urgency score in content: ${article.urgency_score}/10`);
      } else if ('urgency' in article) {  // simple
        contentObj.urgencyScore = article.urgency;
        console.log(`🚨 Converting simple urgency in content: ${article.urgency}/10`);
      }
      
      // Add publishedAt if available
      if ('publishedAt' in article) {
        // Convert string to datetime if needed
        if (typeof article.publishedAt === 'string') {
          try {
            contentObj.publishedAt = new Date(article.publishedAt);
          } catch(e) {
            contentObj.publishedAt = new Date();
          }
        } else {
          contentObj.publishedAt = article.publishedAt;
        }
      }
      
      // Use updateOne with upsert=true to handle duplicates
      const result = await this.collections.content.updateOne(
        { url: article.url },  // Filter by URL
        { $set: contentObj },  // Set all fields
        { upsert: true }  // Create if not exists, update if exists
      );
      
      if (result.upsertedCount > 0 || result.modifiedCount > 0) {
        console.log("✅ Stored article content in contentTest collection");
        if ('importanceScore' in contentObj) {
          console.log(`📊 Stored importance score: ${contentObj.importanceScore}/10`);
        }
        if ('urgencyScore' in contentObj) {
          console.log(`🚨 Stored urgency score: ${contentObj.urgencyScore}/10`);
        }
        return true;
      } else {
        console.error("❌ Failed to store article content");
        return false;
      }
          
    } catch (error) {
      console.error(`❌ Error storing article content: ${error.message}`);
      return false;
    }
  }

  /**
   * Store post history in the post_history collection
   * @param {Object} article - Article object
   * @param {string} content - Generated content
   * @param {Object} postResult - Result from social media posting
   * @param {string} promptType - Type of prompt used (e.g. positive-variation-1)
   * @returns {Promise<boolean>} - True if successful
   */
  async storePostHistory(article, content, postResult = null, promptType = 'unknown') {
    try {
      // Create post history object with the existing expected fields
      const postObj = {
        url: article.url,
        title: article.title,
        source: article.source,
        description: article.description || '',
        content: content,
        promptType: promptType,  // Store the prompt type
        postedAt: new Date(),
        postSuccess: Boolean(postResult),
        characterCount: content.length
      };
      
      // Check all possible score field variations
      // Standard camelCase
      if ('importanceScore' in article) {
        postObj.importanceScore = article.importanceScore;
        console.log(`📊 Storing camelCase importance score in post: ${article.importanceScore}/10`);
      } else if ('importancescore' in article) {  // lowercase
        postObj.importanceScore = article.importancescore;
        console.log(`📊 Converting lowercase importance score in post: ${article.importancescore}/10`);
      } else if ('importance_score' in article) {  // underscore
        postObj.importanceScore = article.importance_score;
        console.log(`📊 Converting underscore importance score in post: ${article.importance_score}/10`);
      } else if ('importance' in article) {  // simple
        postObj.importanceScore = article.importance;
        console.log(`📊 Converting simple importance in post: ${article.importance}/10`);
      }
          
      // Standard camelCase for urgency
      if ('urgencyScore' in article) {
        postObj.urgencyScore = article.urgencyScore;
        console.log(`🚨 Storing camelCase urgency score in post: ${article.urgencyScore}/10`);
      } else if ('urgencyscore' in article) {  // lowercase
        postObj.urgencyScore = article.urgencyscore;
        console.log(`🚨 Converting lowercase urgency score in post: ${article.urgencyscore}/10`);
      } else if ('urgency_score' in article) {  // underscore
        postObj.urgencyScore = article.urgency_score;
        console.log(`🚨 Converting underscore urgency score in post: ${article.urgency_score}/10`);
      } else if ('urgency' in article) {  // simple
        postObj.urgencyScore = article.urgency;
        console.log(`🚨 Converting simple urgency in post: ${article.urgency}/10`);
      }
      
      // Add postUrl and postId if post_result is available
      if (postResult) {
        postObj.postUrl = postResult.url;
        postObj.postId = postResult.id;
      } else {
        postObj.postUrl = null;
        postObj.postId = null;
      }
      
      // Add publishedAt if available
      if ('publishedAt' in article) {
        // Convert string to datetime if needed
        if (typeof article.publishedAt === 'string') {
          try {
            postObj.publishedAt = new Date(article.publishedAt);
          } catch(e) {
            postObj.publishedAt = new Date();
          }
        } else {
          postObj.publishedAt = article.publishedAt;
        }
      }
      
      // Check if we have an existing entry for this URL with postSuccess=false
      const existingEntry = await this.collections.postHistory.findOne({
        url: article.url,
        postSuccess: false
      });
      
      if (existingEntry && !postResult) {
        console.log(`⚠️ Found existing entry for URL, skipping to avoid duplicate`);
        return true;
      } else if (existingEntry && postResult) {
        // Update the existing entry instead of creating a new one
        const result = await this.collections.postHistory.updateOne(
          { _id: existingEntry._id },
          { $set: postObj }
        );
        
        if (result.modifiedCount > 0) {
          console.log("✅ Updated existing post history in post_history collection");
          if ('importanceScore' in postObj) {
            console.log(`📊 Updated importance score in post: ${postObj.importanceScore}/10`);
          }
          if ('urgencyScore' in postObj) {
            console.log(`🚨 Updated urgency score in post: ${postObj.urgencyScore}/10`);
          }
          return true;
        } else {
          console.error("❌ Failed to update existing post history");
          return false;
        }
      } else {
        // Store in post history collection as a new entry
        const result = await this.collections.postHistory.insertOne(postObj);
        
        if (result.insertedId) {
          console.log("✅ Stored post history in post_history collection");
          if ('importanceScore' in postObj) {
            console.log(`📊 Stored importance score in post: ${postObj.importanceScore}/10`);
          }
          if ('urgencyScore' in postObj) {
            console.log(`🚨 Stored urgency score in post: ${postObj.urgencyScore}/10`);
          }
          return true;
        } else {
          console.error("❌ Failed to store post history");
          return false;
        }
      }
          
    } catch (error) {
      console.error(`❌ Error storing post history: ${error.message}`);
      return false;
    }
  }

  /**
   * Check if an article should be considered urgent based on keywords
   * @param {Object} article - Article object with title
   * @returns {Promise<boolean>} - True if the article is urgent
   */
  async checkUrgentNews(article) {
    // Keywords that indicate urgency
    const urgentKeywords = [
      'hack', 'exploit', 'vulnerability', 'attack', 'stolen', 'theft', 'crash',
      'collapse', 'plunge', 'emergency', 'critical', 'urgent', 'breaking',
      'halted', 'suspended', 'SEC charges', 'fraud', 'investigation', 'lawsuit',
      'security breach', 'major loss'
    ];
    
    // Check if title contains any urgent keywords
    const isUrgent = urgentKeywords.some(keyword => 
      article.title.toLowerCase().includes(keyword.toLowerCase())
    );
    
    if (isUrgent) {
      console.log(`🚨 Urgent news detected: ${article.title}`);
    }
    
    return isUrgent;
  }

  /**
   * Get most recently processed articles
   * @param {number} limit - Maximum number of articles to retrieve
   * @returns {Promise<Array>} - List of articles
   */
  async getRecentArticles(limit = 10) {
    if (!this.collections.articles) {
      return [];
    }
    
    try {
      const recentArticles = await this.collections.articles.find()
        .sort({ processedAt: -1 })
        .limit(limit)
        .toArray();
      
      return recentArticles;
    } catch (error) {
      console.error(`❌ Error fetching recent articles: ${error.message}`);
      return [];
    }
  }

  /**
   * Get recent articles with content from contentTest collection
   * @param {number} limit - Maximum number of articles to retrieve
   * @returns {Promise<Array>} - List of articles with content
   */
  async getRecentContent(limit = 10) {
    try {
      // Find recent content, sorting by generatedAt field in descending order
      const contentList = await this.collections.content.find()
        .sort({ generatedAt: -1 })
        .limit(limit)
        .toArray();
      
      console.log(`✅ Retrieved ${contentList.length} recent content items`);
      return contentList;
    } catch (error) {
      console.error(`❌ Error getting recent content: ${error.message}`);
      return [];
    }
  }

  /**
   * Get urgent news from the last X days from processedArticles
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} - List of urgent news articles
   */
  async getRecentUrgentNews(days = 1) {
    try {
      // Calculate the date threshold
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      
      // Find urgent news from the last X days in processedArticles
      const articles = await this.collections.articles.find({
        processedAt: { $gte: cutoffDate },
        isUrgent: true
      }).toArray();
      
      // Convert ObjectId to string for each article
      return articles.map(doc => {
        const serialized = { ...doc };
        
        // Convert ObjectId to string
        serialized._id = doc._id.toString();
        
        // Convert dates to ISO format
        if (serialized.processedAt instanceof Date) {
          serialized.processedAt = serialized.processedAt.toISOString();
        }
        
        if (serialized.publishedAt instanceof Date) {
          serialized.publishedAt = serialized.publishedAt.toISOString();
        }
        
        return serialized;
      });
      
    } catch (error) {
      console.error(`❌ Error retrieving recent urgent news: ${error.message}`);
      return [];
    }
  }

  /**
   * Get the most recent tweet's opening words (for variety enforcement)
   * @returns {Promise<Object|null>} - { firstWords, content } or null
   */
  async getLastTweetOpener() {
    try {
      const lastPost = await this.collections.postHistory.findOne(
        { postSuccess: true, content: { $exists: true, $ne: '' } },
        { sort: { postedAt: -1 } }
      );
      
      if (!lastPost || !lastPost.content) {
        return null;
      }
      
      // Extract first 5 words
      const words = lastPost.content.trim().split(/\s+/).slice(0, 5);
      const firstWords = words.join(' ');
      
      // Detect opener category
      let category = 'unknown';
      const firstWord = words[0] || '';
      
      if (/^\$/.test(firstWord)) {
        category = 'NUMBER';
      } else if (/^(Since|Four|Three|Two|Back|Last|After|Before|During)/.test(firstWord)) {
        category = 'TIME';
      } else if (/^(The|Those|That|This|These)/.test(firstWord)) {
        category = 'THING';
      } else if (/^(Most|Interesting|Hard|Feels|Looks|Seems|Everyone|Quietly|Meanwhile|Underneath)/.test(firstWord)) {
        category = 'OBSERVATION';  // Also catches "Everyone's" which is overused
      } else if (/^(Pulled|Drained|Split|Shifted|Moved|Pushed|Dumped|Flooded|Crashed)/.test(firstWord)) {
        category = 'ACTION';
      } else if (/^[A-Z][a-z]+/.test(firstWord) && !/^(The|Those|That|This|These|Most|Interesting|Everyone|Feels|Looks|Seems|Quietly|Meanwhile|Underneath)/.test(firstWord)) {
        category = 'NAME';
      }
      
      console.log(`📝 Last tweet opener: "${firstWords}..." (category: ${category})`);
      
      return {
        firstWords,
        firstWord,
        category,
        content: lastPost.content.substring(0, 100)
      };
    } catch (error) {
      console.error('Error getting last tweet opener:', error);
      return null;
    }
  }

  /**
   * Get primary hashtags from recent tweets for topic cooldown
   * @param {number} count - Number of recent tweets to check
   * @returns {Promise<string[]>} - Array of primary hashtags
   */
  async getRecentPrimaryHashtags(count = 3) {
    try {
      const recentPosts = await this.collections.postHistory.find(
        { postSuccess: true, content: { $exists: true, $ne: '' } },
        { sort: { postedAt: -1 }, limit: count }
      ).toArray();
      
      if (!recentPosts || recentPosts.length === 0) {
        return [];
      }
      
      const hashtags = [];
      const genericHashtags = ['bitcoin', 'btc', 'ethereum', 'eth', 'crypto', 'cryptocurrency'];
      
      for (const post of recentPosts) {
        const content = post.content || '';
        // Extract all hashtags and find the first SPECIFIC one (not generic)
        const allMatches = content.match(/#([A-Za-z0-9]+)/g) || [];
        for (const match of allMatches) {
          const tag = match.replace('#', '').toLowerCase();
          if (!genericHashtags.includes(tag)) {
            hashtags.push(tag);
            break; // Only take first specific hashtag per post
          }
        }
      }
      
      console.log(`📌 Recent primary hashtags:`, hashtags);
      return hashtags;
    } catch (error) {
      console.error('Error getting recent hashtags:', error);
      return [];
    }
  }

  /**
   * Get key phrases from recent tweets to avoid repetition
   * @param {number} count - Number of recent tweets to check
   * @returns {Promise<string[]>} - Array of distinctive phrases
   */
  async getRecentPhrases(count = 5) {
    try {
      const recentPosts = await this.collections.postHistory.find(
        { postSuccess: true, content: { $exists: true, $ne: '' } },
        { sort: { postedAt: -1 }, limit: count }
      ).toArray();
      
      if (!recentPosts || recentPosts.length === 0) {
        return [];
      }
      
      const phrases = [];
      
      // Patterns to extract distinctive phrases
      const phrasePatterns = [
        /Same \d+ [A-Z]+ on-chain[^.]+/gi,           // "Same 1 BTC on-chain..."
        /Post-[A-Z][a-zA-Z]+/g,                       // "Post-FTX", "Post-ETF"
        /Since the [A-Z][a-zA-Z]+/gi,                 // "Since the ETF..."
        /from [a-z]+ rails to [a-z]+ rails/gi,        // "from degen rails to compliant rails"
        /suits instead of [a-z]+ [A-Z]+s/gi,          // "suits instead of anon PFPs"
        /shadow [a-z]+s?:/gi,                         // "shadow regulators"
        /regime change/gi,
        /What I'm watching/gi,
      ];
      
      for (const post of recentPosts) {
        const content = post.content || '';
        for (const pattern of phrasePatterns) {
          const matches = content.match(pattern);
          if (matches) {
            phrases.push(...matches.map(m => m.trim()));
          }
        }
      }
      
      // Deduplicate and limit
      const uniquePhrases = [...new Set(phrases)].slice(0, 10);
      
      if (uniquePhrases.length > 0) {
        console.log(`🔍 Found ${uniquePhrases.length} recent phrases to avoid:`, uniquePhrases);
      }
      
      return uniquePhrases;
    } catch (error) {
      console.error('Error getting recent phrases:', error);
      return [];
    }
  }

  /**
   * Get posts from the last X days
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} - List of posted articles
   */
  async getRecentPosts(days = 2) {
    try {
      // Calculate date X days ago
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      
      // Query for posts from last X days
      const query = { postedAt: { $gte: daysAgo } };
      
      // Get posts, sorted by most recent first
      const recentPosts = await this.collections.postHistory.find(query)
        .sort({ postedAt: -1 })
        .toArray();
      
      // Convert ObjectIds to strings for JSON serialization and format dates
      const serializedPosts = recentPosts.map(post => {
        const serialized = { ...post };
        
        // Convert ObjectId to string
        serialized._id = post._id.toString();
        
        // Handle dates - convert to ISO string
        if (serialized.postedAt instanceof Date) {
          serialized.postedAt = serialized.postedAt.toISOString();
        }
        
        if (serialized.publishedAt instanceof Date) {
          serialized.publishedAt = serialized.publishedAt.toISOString();
        }
        
        return serialized;
      });
      
      console.log(`✅ Retrieved ${serializedPosts.length} posts from last ${days} days`);
      return serializedPosts;
      
    } catch (error) {
      console.error(`❌ Error retrieving recent posts: ${error.message}`);
      return [];
    }
  }

  /**
   * Mark an article with intent to process to prevent duplicate processing
   * @param {string} url - Article URL
   * @param {string} processingType - Type of processing (regular/urgent)
   * @returns {Promise<boolean>} - True if successfully marked for processing
   */
  async markArticleIntentToProcess(url, processingType = "regular") {
    try {
      // First check if already in articles collection
      if (await this.isArticleProcessed(url)) {
        console.log(`⚠️ Article already processed, cannot mark intent: ${url}`);
        return false;
      }
      
      // Check if intent record exists
      const existing = await this.collections.processingIntents.findOne({ url });
      if (existing) {
        console.warn(`⚠️ Article already marked for processing by ${existing.processing_type}: ${url}`);
        return false;
      }
      
      // Calculate expiration time (1 hour from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      
      // Create new intent record with expiration (TTL)
      const intentRecord = {
        url,
        processing_type: processingType,
        created_at: new Date(),
        // This record will auto-expire after 1 hour to prevent stale intents
        expires_at: expiresAt
      };
      
      const result = await this.collections.processingIntents.insertOne(intentRecord);
      if (result.insertedId) {
        console.log(`✅ Marked article intent to process (${processingType}): ${url}`);
        return true;
      } else {
        console.error(`❌ Failed to mark article intent: ${url}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error marking article intent: ${error.message}`);
      return false;
    }
  }

  /**
   * Clear the intent to process record after processing is complete
   * @param {string} url - Article URL
   * @returns {Promise<boolean>} - True if successful
   */
  async clearArticleProcessingIntent(url) {
    try {
      const result = await this.collections.processingIntents.deleteOne({ url });
      if (result.deletedCount > 0) {
        console.log(`✅ Cleared article processing intent: ${url}`);
        return true;
      } else {
        console.log(`ℹ️ No intent record found to clear: ${url}`);
        return true;  // Return true since there's nothing to clear anyway
      }
    } catch (error) {
      console.error(`❌ Error clearing article intent: ${error.message}`);
      return false;
    }
  }

  /**
   * Get posts since a specific date
   * @param {Date} date - Date to get posts since
   * @param {number} limit - Maximum number of posts to retrieve
   * @returns {Promise<Array>} - List of posts
   */
  async getPostHistorySince(date, limit = 50) {
    try {
      const posts = await this.collections.postHistory.find({
        postedAt: { $gte: date }
      })
        .sort({ postedAt: -1 })
        .limit(limit)
        .toArray();
      
      // Convert ObjectIds to strings for JSON serialization
      const serializedPosts = posts.map(post => {
        const serialized = { ...post };
        serialized._id = post._id.toString();
        
        // Format dates
        if (serialized.postedAt instanceof Date) {
          serialized.postedAt = serialized.postedAt.toISOString();
        }
        
        if (serialized.publishedAt instanceof Date) {
          serialized.publishedAt = serialized.publishedAt.toISOString();
        }
        
        return serialized;
      });
      
      console.log(`✅ Retrieved ${serializedPosts.length} posts since ${date.toISOString()}`);
      return serializedPosts;
    } catch (error) {
      console.error(`❌ Error getting post history since date: ${error.message}`);
      return [];
    }
  }

  /**
   * Get post history between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date 
   * @param {number} limit - Maximum number of posts to retrieve
   * @returns {Promise<Array>} - Array of post history objects
   */
  async getPostHistoryBetweenDates(startDate, endDate, limit = 100) {
    try {
      const posts = await this.collections.postHistory.find({
        postedAt: { 
          $gte: startDate,
          $lte: endDate
        }
      })
        .sort({ postedAt: -1 })
        .limit(limit)
        .toArray();
      
      // Convert ObjectIds to strings for JSON serialization
      const serializedPosts = posts.map(post => {
        const serialized = { ...post };
        serialized._id = post._id.toString();
        
        // Format dates
        if (serialized.postedAt instanceof Date) {
          serialized.postedAt = serialized.postedAt.toISOString();
        }
        
        if (serialized.publishedAt instanceof Date) {
          serialized.publishedAt = serialized.publishedAt.toISOString();
        }
        
        return serialized;
      });
      
      console.log(`✅ Retrieved ${serializedPosts.length} posts between ${startDate.toISOString()} and ${endDate.toISOString()}`);
      return serializedPosts;
    } catch (error) {
      console.error(`❌ Error getting post history between dates: ${error.message}`);
      return [];
    }
  }

  /**
   * Close the MongoDB connection
   */
  async close() {
    if (this.client) {
      await this.client.close();
      console.log('✅ MongoDB connection closed');
    }
  }
}

module.exports = MongoDBService; 