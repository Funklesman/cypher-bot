require('dotenv').config();
const { generateCryptoDiary } = require('./src/js/crypto_diary');

// Date range for the diary
const startDate = new Date('2025-04-06T00:00:00Z');
const endDate = new Date('2025-04-08T23:59:59Z');

async function generateCustomDiary() {
  try {
    console.log('Generating crypto diary for April 6-8...');
    const diary = await generateCryptoDiary();
    
    console.log('\n--- CRYPTO DIARY FOR APRIL 6-8 ---\n');
    console.log(diary);
  } catch (error) {
    console.error('Error generating diary:', error);
    process.exit(1);
  }
}

generateCustomDiary(); 