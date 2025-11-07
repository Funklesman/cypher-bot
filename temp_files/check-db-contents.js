/**
 * Check database contents
 * 
 * Quick script to check what's in the processing_intents collection
 */

const axios = require('axios');

async function checkProcessingIntents() {
  try {
    const response = await axios.get('http://localhost:5001/api/check-intents');
    console.log('Current processing intents in database:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error checking processing intents:', error.message);
  }
}

checkProcessingIntents(); 