# Comprehensive Implementation Plan for Enhanced Tweet Bot

## 1. Urgent News Detection (30-minute scan)

### Core Functionality
- Implement cron job running every 30 minutes using `node-cron`
- Create new function `scanForUrgentNews()` that:
  - Fetches recent crypto news (last 2-4 hours)
  - Filters out already processed articles
  - Sends each article to OpenAI for urgency evaluation

### Urgency Evaluation
- Create a specialized prompt for OpenAI that evaluates:
  - Time sensitivity (is this breaking news?)
  - Market impact potential
  - Regulatory significance
  - Community interest level
- Return a numerical score (1-10) and brief justification
- Set configurable threshold (e.g., ≥7 for immediate posting)

### Processing & Posting
- For urgent articles:
  - Use existing `analyzeArticleContent()` for sentiment analysis
  - Select appropriate prompt template based on sentiment
  - Generate tweet content with `generateTweet()`
  - Add an "URGENT:" or "🚨" prefix to indicate breaking news
  - Post immediately to Mastodon with `postToMastodon()`
- Log urgent posts with timestamps in dedicated collection

### Implementation Steps
1. Create `scanForUrgentNews.js` module
2. Add urgency evaluation prompt templates
3. Implement scoring algorithm with OpenAI
4. Set up 30-minute cron job in main script
5. Add configuration options for urgency threshold
6. Create specialized MongoDB collection for urgent news tracking

## 2. Daily Crypto Diary

### Core Functionality
- Schedule daily execution (8 PM local time)
- Create function `generateCryptoDiary()` that:
  - Collects 10-15 most significant articles from past 24 hours
  - Prioritizes based on impact/relevance (not just recency)
  - Groups related stories by theme/topic

### Content Generation
- Develop specialized prompt for diary-style summary
- Structure output with consistent sections:
  - "Today's Market Overview"
  - "Top Stories"
  - "Technical Developments"
  - "Regulatory Updates"
  - "Projects to Watch"
- Generate two formats:
  1. Mastodon post (extended length)
  2. HTML/Markdown for Cypher University website

### Distribution
- Post to Mastodon with specialized diary formatting
- Export formatted content for website integration
- Option to automatically publish via website API if available
- Email delivery option as backup

### Implementation Steps
1. Create `cryptoDiary.js` module
2. Develop article collection and filtering logic
3. Create diary prompt templates
4. Implement OpenAI integration for summary generation 
5. Build output formatters for multiple platforms
6. Set up daily scheduler
7. Add MongoDB tracking for diary entries

## 3. Admin Interface

### Core Technology
- Express.js web server
- Simple authentication system
- Responsive dashboard using Bootstrap/Tailwind
- Socket.io for real-time updates (optional)

### Dashboard Features
- Authentication system
- Main dashboard with:
  - Key metrics (posts, engagement, article processing stats)
  - Mastodon connection status
  - Recent posts timeline
  - Upcoming scheduled posts

### Control Features
- View pending articles ready for processing
- Manually trigger posts
- Adjust urgency threshold
- Schedule or trigger daily diary generation
- Preview generated content before posting
- View logs of API calls and post history

### Setup & Configuration
- Environment variable management
- Prompt template editing interface
- Schedule configuration
- API key management

### Implementation Steps
1. Create Express.js application structure
2. Set up authentication system
3. Design dashboard layout and components
4. Implement core API endpoints for bot control
5. Build monitoring and status components
6. Create content preview system
7. Implement configuration management
8. Add real-time updates with Socket.io

## Integration Strategy

### Phase 1: Core Functionality
1. Implement urgent news detection
2. Add daily crypto diary generation
3. Ensure proper MongoDB logging for all features

### Phase 2: Admin Interface
1. Build basic Express.js server
2. Create authentication system
3. Implement dashboard with core metrics
4. Add manual control capabilities

### Phase 3: Advanced Features
1. Enhanced analytics
2. Content preview system
3. Custom prompt editing
4. Export capabilities for website
5. Email notifications

### Phase 4: Optimization
1. Performance tuning
2. Security hardening
3. Error handling improvements
4. Documentation

## Technical Considerations

### Dependencies
- OpenAI API extensions for specialized prompts
- Advanced MongoDB queries for article management
- Templating system for output formatting
- Authentication middleware for admin interface
- Potential API integrations for Cypher University website

### Challenges
- Rate limiting on external APIs (OpenAI, News sources)
- Maintaining state between cron executions
- Ensuring no duplicate urgent news posts
- Scaling MongoDB for increased article tracking
- Securing admin interface

## Cypher University Website Integration

### Content Formatting
- Create specialized HTML/Markdown templates for website content
- Include embedded links to original sources
- Add style elements consistent with Cypher University branding
- Structure content for easy CMS integration

### Publishing Options
- Generate exportable formats (HTML, Markdown, JSON)
- Develop API endpoint for automated publishing if CMS supports it
- Email delivery with formatted content for manual posting
- RSS feed generation for automated syndication

### Enhanced Features for Website
- More detailed analysis than Mastodon version
- Data visualizations for market trends
- Interactive elements (expandable sections, tooltips)
- Related article recommendations
- Historical archive of past diary entries
