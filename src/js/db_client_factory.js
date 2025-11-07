/**
 * Database Client Factory
 * 
 * This module provides a factory for creating the MongoDB client.
 */

const MongoDBClient = require('./mongodb_client');

// Add debug flag
const DEBUG = process.env.DEBUG_DB === 'true';

class DBClientFactory {
  /**
   * Create a database client
   * @returns {Object} - MongoDB client instance
   */
  static createClient() {
    if (DEBUG) {
      console.log(`[DB Factory] Creating MongoDB client`);
    }
    
    console.log('🔄 Using direct Node.js MongoDB client');
    return new MongoDBClient();
  }
}

module.exports = DBClientFactory; 