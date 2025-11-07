/**
 * TweetBot Startup Script
 * 
 * This script provides an easy way to start the TweetBot in different modes:
 * 1. Testing Mode: Regular tweets every hour, urgent news every 30 minutes
 * 2. Production Mode: Regular tweets every 6 hours, urgent news every 30 minutes
 */

require('dotenv').config();
const { spawn } = require('child_process');
const readline = require('readline');

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Show the startup menu
console.log('\n📱 TweetBot Startup Menu 📱');
console.log('---------------------------');
console.log('1. Start in Testing Mode (Hourly tweets + Urgent detection)');
console.log('2. Start in Production Mode (6-Hour tweets + Urgent detection)');
console.log('3. Run Urgent News Detection Test (One-time scan)');
console.log('4. Exit');
console.log('---------------------------');

// Start process based on user choice
rl.question('Enter your choice (1-4): ', (choice) => {
  let child;
  
  switch (choice.trim()) {
    case '1':
      console.log('\n🧪 Starting TweetBot in Testing Mode...');
      child = spawn('node', ['tweetbot-testing.js'], { stdio: 'inherit' });
      break;
    
    case '2':
      console.log('\n🚀 Starting TweetBot in Production Mode...');
      child = spawn('node', ['tweetbot-production.js'], { stdio: 'inherit' });
      break;
    
    case '3':
      console.log('\n🔍 Running Urgent News Detection Test...');
      spawn('node', ['Test files/test-urgent-news.js'], { stdio: 'inherit' })
        .on('close', (code) => {
          console.log(`\nTest completed with code ${code}`);
          process.exit(0);
        });
      break;
    
    case '4':
      console.log('Exiting...');
      rl.close();
      process.exit(0);
      break;
    
    default:
      console.log('Invalid choice. Exiting...');
      rl.close();
      process.exit(1);
  }
  
  if (child) {
    console.log('\n✅ TweetBot started successfully');
    console.log('📋 Press Ctrl+C to stop\n');
    
    child.on('error', (err) => {
      console.error('❌ Error starting TweetBot:', err);
      rl.close();
      process.exit(1);
    });
    
    child.on('close', (code) => {
      console.log(`\n🛑 TweetBot exited with code ${code}`);
      rl.close();
      process.exit(code);
    });
  }
  
  rl.close();
}); 