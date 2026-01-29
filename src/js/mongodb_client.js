/**
 * MongoDB Client
 * Direct MongoDB client that replaces the Python bridge
 */

const MongoDBService = require('./mongodb_service');

class MongoDBClient {
  constructor() {
    console.log('Initializing MongoDBClient...');
    this.mongoService = new MongoDBService();
    this.initialized = false;
    console.log('Starting MongoDB connection...');
    this.initPromise = this.initialize();
  }
  
  /**
   * Initialize the MongoDB connection
   * @returns {Promise<boolean>} True if connection successful
   */
  async initialize() {
    console.log('initialize() called');
    if (!this.initialized) {
      console.log('Connecting to MongoDB...');
      this.initialized = await this.mongoService.connect();
      console.log(`MongoDB connection result: ${this.initialized}`);
    }
    return this.initialized;
  }
  
  /**
   * Check if the MongoDB service is healthy
   * @returns {Promise<boolean>} - True if the service is healthy
   */
  async isHealthy() {
    await this.initPromise;
    return this.initialized;
  }
  
  /**
   * Check if an article has been processed already
   * @param {string} url - Article URL
   * @returns {Promise<boolean>} - True if the article has been processed
   */
  async isArticleProcessed(url) {
    await this.initPromise;
    return this.mongoService.isArticleProcessed(url);
  }
  
  /**
   * Mark an article as processed
   * @param {Object} article - Article object
   * @returns {Promise<boolean>} - True if successful
   */
  /**
   * REMOVED: markArticleAsProcessed functions - no longer needed
   * Articles are now tracked automatically in post_history collection
   * Use storePostHistory() instead for storing article data
   */
  
  /**
   * Store article content
   * @param {Object} article - Article object
   * @param {string} content - Generated content
   * @param {string} promptType - Type of prompt used (e.g. positive-variation-1)
   * @returns {Promise<boolean>} - Success status
   */
  async storeArticleContent(article, content, promptType = 'unknown') {
    await this.initPromise;
    
    // Log scores if they exist
    if (article.importanceScore !== undefined) {
      console.log(`📊 Sending content importance score: ${article.importanceScore}/10`);
    }
    if (article.urgencyScore !== undefined) {
      console.log(`🚨 Sending content urgency score: ${article.urgencyScore}/10`);
    }
    
    return this.mongoService.storeArticleContent(article, content, promptType);
  }
  
  /**
   * Store post history
   * @param {Object} article - Article object
   * @param {string} content - Generated content
   * @param {Object} postResult - Result from posting to social media
   * @param {string} promptType - Type of prompt used (e.g. positive-variation-1)
   * @returns {Promise<boolean>} - Success status
   */
  async storePostHistory(article, content, postResult, promptType = 'unknown') {
    await this.initPromise;
    
    // Log scores if they exist
    if (article.importanceScore !== undefined) {
      console.log(`📊 Sending post history importance score: ${article.importanceScore}/10`);
    }
    if (article.urgencyScore !== undefined) {
      console.log(`🚨 Sending post history urgency score: ${article.urgencyScore}/10`);
    }
    
    return this.mongoService.storePostHistory(article, content, postResult, promptType);
  }
  
  /**
   * Check if an article should be considered urgent
   * @param {Object} article - Article object
   * @returns {Promise<boolean>} - True if the article is urgent
   */
  async checkUrgentNews(article) {
    await this.initPromise;
    return this.mongoService.checkUrgentNews(article);
  }
  
  /**
   * Get recently processed articles
   * @param {number} limit - Number of articles to retrieve
   * @returns {Promise<Array>} - Array of article objects
   */
  async getRecentArticles(limit = 10) {
    await this.initPromise;
    return this.mongoService.getRecentArticles(limit);
  }
  
  /**
   * Get article history with content from the contentTest collection
   * @param {number} limit - Number of articles to retrieve
   * @returns {Promise<Array>} - Array of article objects with content
   */
  async getArticleHistory(limit = 10) {
    await this.initPromise;
    return this.mongoService.getRecentContent(limit);
  }
  
  /**
   * Get recent urgent news from the last X days
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} - Array of urgent articles
   */
  async getRecentUrgentNews(days = 1) {
    await this.initPromise;
    return this.mongoService.getRecentUrgentNews(days);
  }
  
  /**
   * Get recently posted articles
   * @param {number} days - Number of days to look back
   * @returns {Promise<Array>} - Array of recently posted articles
   */
  async getRecentPosts(days = 2) {
    await this.initPromise;
    return this.mongoService.getRecentPosts(days);
  }
  
  /**
   * Mark an article with intent to process to prevent race conditions
   * @param {string} url - Article URL
   * @param {string} processingType - Type of processing (regular or urgent)
   * @returns {Promise<boolean>} - True if successfully marked, false if already being processed
   */
  async markArticleIntentToProcess(url, processingType = 'regular') {
    await this.initPromise;
    return this.mongoService.markArticleIntentToProcess(url, processingType);
  }
  
  /**
   * Clear an article's processing intent after completion
   * @param {string} url - Article URL
   * @returns {Promise<boolean>} - True if successfully cleared
   */
  async clearArticleProcessingIntent(url) {
    await this.initPromise;
    return this.mongoService.clearArticleProcessingIntent(url);
  }
  
  /**
   * Get recent posts from a specific date
   * @param {Date} date - Date to start from
   * @param {number} limit - Maximum number of posts to retrieve
   * @returns {Promise<Array>} - Array of post history objects
   */
  async getPostHistorySince(date, limit = 50) {
    await this.initPromise;
    return this.mongoService.getPostHistorySince(date, limit);
  }
  
  /**
   * Get post history between two dates
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {number} limit - Maximum number of posts to retrieve
   * @returns {Promise<Array>} - Array of post history objects
   */
  async getPostHistoryBetweenDates(startDate, endDate, limit = 100) {
    await this.initPromise;
    return this.mongoService.getPostHistoryBetweenDates(startDate, endDate, limit);
  }
  
  /**
   * Get the last tweet opener for variety enforcement
   * @returns {Promise<Object|null>} - { firstWords, firstWord, category, content } or null
   */
  async getLastTweetOpener() {
    await this.initPromise;
    return this.mongoService.getLastTweetOpener();
  }

  /**
   * Get recent phrases to avoid repetition
   * @param {number} count - Number of recent tweets to check
   * @returns {Promise<string[]>} - Array of distinctive phrases
   */
  async getRecentPhrases(count = 5) {
    await this.initPromise;
    return this.mongoService.getRecentPhrases(count);
  }

  /**
   * Get recent primary hashtags for topic cooldown
   * @param {number} count - Number of recent tweets to check
   * @returns {Promise<string[]>} - Array of primary hashtags
   */
  async getRecentPrimaryHashtags(count = 3) {
    await this.initPromise;
    return this.mongoService.getRecentPrimaryHashtags(count);
  }

  /**
   * Get recently used wisdom topics to avoid repetition
   * @param {number} days - Number of days to look back
   * @returns {Promise<string[]>} - Array of recently used topic descriptions
   */
  async getRecentWisdomTopics(days = 14) {
    await this.initPromise;
    return this.mongoService.getRecentWisdomTopics(days);
  }

  /**
   * Get recently used reflection phrases for variety enforcement
   * @param {number} count - Number of recent phrases to retrieve
   * @returns {Promise<string[]>} - Array of recently used reflection phrases
   */
  async getRecentReflectionPhrases(count = 5) {
    await this.initPromise;
    return this.mongoService.getRecentReflectionPhrases(count);
  }

  /**
   * Get recent successful post (for catch-up logic)
   * @param {Date} since - Only look for posts after this date
   * @returns {Promise<Object|null>} - Recent post or null
   */
  async getRecentSuccessfulPost(since) {
    await this.initPromise;
    return this.mongoService.getRecentSuccessfulPost(since);
  }
}

module.exports = MongoDBClient; 