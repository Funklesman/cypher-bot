/**
 * TweetBot Startup Script
 * 
 * This script provides a clean interface to start the TweetBot
 * in different modes. It replaces the multiple starter scripts.
 */

const readline = require('readline');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Import our main bot module
const bot = require('../src/js/index');

// Import API server
const ApiServer = require('../src/api/server');

// Check if we're running in production mode
const isProduction = process.argv.includes('--production');

// Create readline interface for user interaction
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Function to check if MongoDB is accessible (legacy function name)
async function checkPythonAPI() {
  try {
    // This actually checks MongoDB connectivity via the bot's health check
    const bot = require('../src/js/index');
    const dbClient = require('../src/js/db_client_factory').createClient();
    return await dbClient.isHealthy();
  } catch (error) {
    return false;
  }
}

// Display menu and handle user selection
async function showMenu() {
  console.clear();
  console.log('🤖 Cypher University TweetBot');
  console.log('============================');
  console.log('');
  
  // Check MongoDB connectivity
  const mongoConnected = await checkPythonAPI(); // Note: function name is legacy but checks MongoDB
  if (!mongoConnected) {
    console.log('⚠️  WARNING: Cannot connect to MongoDB.');
    console.log('❗ Please ensure MongoDB is running and accessible.');
    console.log('');
  } else {
    console.log('✅ MongoDB connection is healthy.');
  }
  
  console.log('Select an option:');
  console.log('');
  console.log('1. Start in Testing Mode (hourly posts)');
  console.log('2. Start in Production Mode (posts every 6 hours)');
  console.log('3. Post a Single Tweet');
  console.log('4. Scan for Urgent News');
  console.log('5. Exit');
  console.log('');
  
  // If running in production, automatically select option 2
  if (isProduction) {
    console.log('Running in production mode...');
    startBot(2);
    return;
  }
  
  rl.question('Enter your choice (1-5): ', (answer) => {
    const choice = parseInt(answer, 10);
    if (isNaN(choice) || choice < 1 || choice > 5) {
      console.log('❌ Invalid choice. Please enter a number between 1 and 5.');
      setTimeout(showMenu, 2000);
      return;
    }
    
    startBot(choice);
  });
}

// Start the bot based on user's selection
async function startBot(choice) {
  // Close readline interface
  rl.close();
  
  // Start API server for production/testing modes
  if (choice === 1 || choice === 2) {
    const apiPort = process.env.API_PORT || 3000;
    const apiServer = new ApiServer(apiPort);
    
    try {
      await apiServer.start();
      console.log('✅ API server started successfully');
    } catch (error) {
      console.error('⚠️ Failed to start API server:', error.message);
      console.log('   Bot will continue running without API');
    }
  }
  
  switch (choice) {
    case 1:
      console.log('🚀 Starting TweetBot in Testing Mode...');
      bot.startTestingMode();
      break;
    case 2:
      console.log('🚀 Starting TweetBot in Production Mode...');
      bot.startProductionMode();
      break;
    case 3:
      console.log('🚀 Posting a Single Tweet...');
      await bot.postSingleItem();
      console.log('✅ Done!');
      process.exit(0);
      break;
    case 4:
      console.log('🔍 Scanning for Urgent News...');
      await bot.scanUrgentNews();
      console.log('✅ Done!');
      process.exit(0);
      break;
    case 5:
      console.log('👋 Exiting...');
      process.exit(0);
      break;
  }
}

// Start the app
showMenu(); 