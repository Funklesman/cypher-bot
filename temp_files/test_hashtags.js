/**
 * Test script for hashtag generation
 */

require('dotenv').config();
const OpenAI = require('openai');

// OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Sample article
const testArticle = {
    title: "BlackRock to List Bitcoin ETP in Europe in First Crypto Foray Outside U.S.",
    description: "BlackRock will expand beyond the U.S. bitcoin market for the first time with a bitcoin ETP listing in Europe, sources told CoinDesk.",
};

// Hashtag generation function
async function testHashtagGeneration(title, description, model = "gpt-5") {
    try {
        console.log(`\n=== Testing hashtag generation with ${model} ===`);
        console.log(`Title: ${title}`);
        console.log(`Description: ${description || "No description"}`);
        console.log("----------------------------------------");

        const response = await openai.chat.completions.create({
            model: model,
            messages: [
                {
                    role: "system",
                    content: `You are an AI that generates relevant crypto hashtags for social media posts. Analyze the given news content and generate hashtags that:
1. Are highly relevant to the specific news content.
2. Include a mix of general crypto terms and specific news-related terms.
3. Consider trending topics in the crypto space.
4. Include specific cryptocurrency names if mentioned.
5. Are formatted properly with a # symbol.
6. Do not duplicate concepts.

IMPORTANT: Return ONLY a valid JSON object with a 'hashtags' property containing an array of strings. Format your response as: {"hashtags": ["#hashtag1", "#hashtag2", ...]}
Do not include code blocks, markdown, or any other text in your response.`
                },
                {
                    role: "user",
                    content: `Generate relevant crypto hashtags for this news:
Title: ${title}
Description: ${description || "No description available"}

Your response must be a valid JSON object with a hashtags array.`
                }
            ],
            temperature: 0.7,
            response_format: { type: "json_object" }
        });
        
        const content = response.choices[0].message.content.trim();
        console.log("Raw response from OpenAI:");
        console.log(content);
        console.log("----------------------------------------");
        
        // Process the response
        let hashtagArray;
        
        try {
            const parsed = JSON.parse(content);
            console.log("Successfully parsed JSON:", parsed);
            
            // Handle both array and object responses
            if (Array.isArray(parsed)) {
                console.log("Response is an array");
                hashtagArray = parsed;
            } else if (typeof parsed === 'object') {
                // Check for a hashtags property (most likely case based on our prompt)
                if (parsed.hashtags && Array.isArray(parsed.hashtags)) {
                    hashtagArray = parsed.hashtags;
                    console.log('Found hashtags array property');
                } 
                // Otherwise extract values that look like hashtags
                else {
                    console.log("Response is an object, extracting hashtag values");
                    
                    // First try to find an array property
                    const arrayProps = Object.values(parsed).filter(val => Array.isArray(val));
                    if (arrayProps.length > 0) {
                        hashtagArray = arrayProps[0];
                        console.log('Found array property in response object:', hashtagArray);
                    } else {
                        // Otherwise extract string values that might be hashtags
                        hashtagArray = Object.values(parsed)
                            .filter(val => typeof val === 'string')
                            .filter(val => val.includes('#') || !val.includes(' ')); // Likely hashtags
                        
                        console.log('Extracted string values from object:', hashtagArray);
                    }
                }
            }
        } catch (error) {
            console.error("Error parsing JSON:", error);
            console.log("Attempting regex extraction");
            
            // Try regex extraction
            const hashtagRegex = /#\w+/g;
            const matches = content.match(hashtagRegex);
            if (matches) {
                console.log("Extracted hashtags using regex:", matches);
                hashtagArray = matches;
            } else {
                console.log("No hashtags found with regex, using fallbacks");
                hashtagArray = ["#Crypto", "#Blockchain"];
            }
        }
        
        // Ensure we have a valid array
        if (!Array.isArray(hashtagArray)) {
            console.log('Invalid hashtagArray, using fallback');
            hashtagArray = ["#Crypto", "#Blockchain"];
        }
        
        // Format all hashtags properly and remove duplicates
        const formattedHashtags = [...new Set(hashtagArray)]
            .filter(tag => tag && typeof tag === 'string')
            .map(tag => {
                tag = tag.trim();
                // Remove any quotes or special characters
                tag = tag.replace(/["'`]/g, '');
                // Ensure it has a hashtag
                return tag.startsWith('#') ? tag : `#${tag}`;
            });
        
        console.log(`Final processed hashtags (${formattedHashtags.length}):`, formattedHashtags);
        
        // Return the top 2 most relevant hashtags
        const finalHashtags = formattedHashtags.slice(0, 2);
        console.log("Selected hashtags:", finalHashtags);
        
        return finalHashtags;
    } catch (error) {
        console.error("Error in hashtag generation:", error);
        return ["#Crypto", "#Blockchain"];
    }
}

// Run tests with both models
async function runTests() {
    try {
        console.log("Starting tests...");
        
            // Test with GPT-5
    await testHashtagGeneration(testArticle.title, testArticle.description, "gpt-5");
        
        // Test with GPT-5-mini
        await testHashtagGeneration(testArticle.title, testArticle.description, "gpt-5-mini");
        
        console.log("\nAll tests completed");
    } catch (err) {
        console.error("Tests failed:", err);
    }
}

// Run the tests
runTests(); 