# Prompt Testing Tool

This tool allows you to test different prompt variations with real news articles to compare outputs and iterate on prompt design.

## How to Use

1. Make sure your environment variables are set up in your `.env` file:
   - `OPENAI_API_KEY`
   - `NEWS_API_KEY` 
   - Other API keys needed for article fetching

2. Choose which type of prompts to test by editing the `TEST_MODE` variable at the top of `test-prompts.js`:
   ```javascript
   const TEST_MODE = 'negative'; // Options: 'negative', 'positive', 'neutral'
   ```

3. Run the script:
   ```bash
   node test-prompts.js
   ```

4. The script will:
   - Fetch a recent real crypto news article
   - Test both prompt variations for the selected mode (negative/positive/neutral)
   - Display the generated content for each variation for comparison

5. Workflow for prompt iteration:
   - Run the script to see the current outputs
   - Make changes to your prompts in `index.js`
   - Run the script again to compare new outputs
   - Repeat until satisfied with results

## Script Features

- Fetches real articles for authentic testing
- Tests both prompt variations of the selected type
- Restores the original system prompt function after testing
- Handles errors gracefully
- Shows character counts for tweet length monitoring

## Switching Between Prompt Types

To test different types of prompts:

1. Edit the script to change `TEST_MODE` to your desired type:
   - `negative` - For testing negative sentiment prompts
   - `positive` - For testing positive sentiment prompts  
   - `neutral` - For testing neutral sentiment prompts

2. Run the script again to test the new prompt type

## Troubleshooting

- If no articles are found, the script will use a fallback test article
- If content generation fails, the script will display an error message
- Make sure your OpenAI API key is valid and has sufficient credits 