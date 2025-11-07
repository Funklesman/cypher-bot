/**
 * Webflow CMS Integration
 * 
 * Automatically publishes crypto diary entries to Webflow collections
 */

// Load environment variables
require('dotenv').config();

const axios = require('axios');

class WebflowClient {
  constructor() {
    this.apiToken = process.env.WEBFLOW_API_TOKEN;
    this.siteId = process.env.WEBFLOW_SITE_ID;
    this.collectionId = process.env.WEBFLOW_COLLECTION_ID;
    this.baseUrl = 'https://api.webflow.com';
    
    this.isConfigured = this.apiToken && this.siteId && this.collectionId;
    
    if (this.isConfigured) {
      console.log('✅ Webflow client initialized');
    } else {
      console.log('⚠️ Webflow not configured - set WEBFLOW_API_TOKEN, WEBFLOW_SITE_ID, and WEBFLOW_COLLECTION_ID');
    }
  }

  /**
   * Create a new diary entry in Webflow CMS using API v2
   */
  async createDiaryEntry(diaryContent, metadata = {}) {
    if (!this.isConfigured) {
      console.log('⚠️ Webflow not configured - skipping CMS upload');
      return null;
    }

    try {
      console.log('📤 Publishing diary entry to Webflow CMS using API v2...');
      
      // Generate title and slug from date
      const today = new Date();
      const dateStr = today.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
      const title = `Crypto Diary - ${dateStr}`;
      const slug = `crypto-diary-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      // Prepare the data for Webflow API v2 format
      const payload = {
        fieldData: {
          'name': title, // Required: title field
          'slug': slug,  // Required: URL slug
          'date': today.toISOString(), // Required: publication date
          'content': diaryContent, // Required: Rich text field for diary content
          // Analytics metadata fields
          ...metadata
        },
        isArchived: false,
        isDraft: false  // Publish immediately
      };

      // Make the API request using v2 endpoint and headers
      const response = await axios.post(
        `https://api.webflow.com/v2/collections/${this.collectionId}/items`,
        payload,
        {
          headers: {
            'accept': 'application/json',
            'authorization': `Bearer ${this.apiToken}`,
            'content-type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data) {
        console.log(`✅ Diary entry published to Webflow: ${title}`);
        console.log(`🔗 Item ID: ${response.data.id}`);
        
        // Optionally publish the site to make changes live
        if (process.env.WEBFLOW_AUTO_PUBLISH === 'true') {
          await this.publishSite();
        }
        
        return response.data;
      }
    } catch (error) {
      console.error('❌ Error publishing to Webflow:', error.message);
      if (error.response) {
        console.error('Response data:', error.response.data);
        console.error('Response status:', error.response.status);
      }
      return null;
    }
  }



  /**
   * Publish the Webflow site to make changes live
   */
  async publishSite() {
    try {
      console.log('🚀 Publishing Webflow site...');
      
      const response = await axios.post(
        `${this.baseUrl}/sites/${this.siteId}/publish`,
        {
          domains: ['your-domain.webflow.io'] // Update with your actual domains
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiToken}`,
            'Accept-Version': '1.0.0',
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data) {
        console.log('✅ Webflow site published successfully');
        return response.data;
      }
    } catch (error) {
      console.error('❌ Error publishing Webflow site:', error.message);
      return null;
    }
  }

  /**
   * Test the Webflow connection using API v2
   */
  async testConnection() {
    if (!this.isConfigured) {
      console.log('❌ Webflow not configured');
      return false;
    }

    try {
      console.log('🔍 Testing Webflow connection using API v2...');
      
      const response = await axios.get(
        `https://api.webflow.com/v2/collections/${this.collectionId}`,
        {
          headers: {
            'accept': 'application/json',
            'authorization': `Bearer ${this.apiToken}`
          },
          timeout: 10000
        }
      );

      if (response.data) {
        console.log(`✅ Connected to Webflow collection: ${response.data.displayName}`);
        return true;
      }
    } catch (error) {
      console.error('❌ Webflow connection failed:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return false;
    }
  }

  /**
   * Get collection info to verify setup using API v2
   */
  async getCollectionInfo() {
    if (!this.isConfigured) {
      return null;
    }

    try {
      const response = await axios.get(
        `https://api.webflow.com/v2/collections/${this.collectionId}`,
        {
          headers: {
            'accept': 'application/json',
            'authorization': `Bearer ${this.apiToken}`
          },
          timeout: 10000
        }
      );

      if (response.data) {
        console.log(`📁 Collection: ${response.data.displayName}`);
        console.log(`📊 Fields available:`, response.data.fields.map(f => f.slug).join(', '));
        return response.data;
      }
    } catch (error) {
      console.error('❌ Error getting collection info:', error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      return null;
    }
  }
}

module.exports = WebflowClient;