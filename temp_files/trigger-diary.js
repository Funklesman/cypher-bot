require('dotenv').config();
const { generateCryptoDiary } = require('../src/js/crypto_diary');

async function triggerDiary() {
  console.log('🚀 Manually triggering Crypto Diary generation...');
  try {
    const content = await generateCryptoDiary();
    if (content) {
      console.log('✅ Diary generated successfully!');
      console.log('\n=== Content Preview ===');
      console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
      console.log(`\nTotal length: ${content.length} characters`);
    } else {
      console.error('❌ Failed to generate diary content');
    }
  } catch (error) {
    console.error('❌ Error generating diary:', error);
  }
  process.exit(0);
}

triggerDiary(); 