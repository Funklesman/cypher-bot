# 📤 Webflow CMS Integration Setup

Automatically publish your crypto diary entries to your Webflow website's CMS collection.

## 🚀 Quick Setup

### 1. Get Webflow API Credentials

1. **Get API Token:**
   - Go to [Webflow Account Settings](https://webflow.com/dashboard/account/general)
   - Scroll to "API Access" section
   - Click "Generate API token"
   - Copy the token

2. **Get Site ID:**
   - Go to your Webflow site dashboard
   - Click "Site settings" 
   - Find "Site ID" in the General tab
   - Copy the Site ID

3. **Create Collection & Get Collection ID:**
   - In your Webflow Designer, create a new Collection called "Crypto Diary"
   - Add these fields to your collection:
     - **Name** (Plain Text) - for the diary title
     - **Slug** (Plain Text) - for URL slug  
     - **Date** (Date/Time) - for publication date
     - **Content** (Rich Text) - for the main diary content
     - **Excerpt** (Plain Text) - for preview text
     - **Author** (Plain Text) - will be "Crypto Professor"
     - **Category** (Plain Text) - will be "Daily Analysis"
     - **Article Count** (Number) - number of articles analyzed
     - **Avg Importance** (Number) - average importance score
     - **Top Sources** (Plain Text) - main news sources
     - **Topics Covered** (Plain Text) - topics in the diary
   - Publish your site to create the collection
   - Get Collection ID from Collection Settings

### 2. Configure Environment Variables

Add these to your `.env` file:

```bash
# Webflow CMS Integration
WEBFLOW_POST_ENABLED=true
WEBFLOW_API_TOKEN=your_actual_api_token_here
WEBFLOW_SITE_ID=your_actual_site_id_here  
WEBFLOW_COLLECTION_ID=your_actual_collection_id_here
WEBFLOW_AUTO_PUBLISH=false  # Set to true to auto-publish site after posting
```

### 3. Test the Integration

Run the test script to verify everything works:

```bash
npm run test:webflow
```

This will:
- ✅ Test your API connection
- ✅ Verify collection access  
- ✅ Create a test diary entry
- ✅ Show you what the integration looks like

### 4. Enable Auto-Publishing

Once tested, your crypto diary will automatically post to Webflow every time it generates:

```bash
# Generate diary manually (will auto-post to Webflow)
npm run diary:generate

# Or let it run on schedule (daily at 8 PM)
npm run start:prod
```

## 🎯 What Gets Posted

Each diary entry includes:

### **Content:**
- **Title:** "Crypto Diary - [Date]"
- **Slug:** "crypto-diary-YYYY-MM-DD"  
- **Content:** Full markdown diary content
- **Excerpt:** Auto-generated preview (160 chars)

### **Metadata:**
- **Article Count:** Number of articles analyzed
- **Avg Importance:** Average importance score (1-10)
- **Top Sources:** Main news sources used
- **Topics Covered:** Key crypto topics discussed

## 🔧 Customization

### Collection Fields

Modify the collection fields in Webflow Designer as needed. Update the field mapping in `src/js/webflow_client.js` if you change field names.

### Auto-Publishing

Set `WEBFLOW_AUTO_PUBLISH=true` to automatically publish your site after each diary post (makes changes live immediately).

### Content Format

The diary content is posted in **Markdown format**, which Webflow Rich Text fields handle well. You can customize the formatting in your Webflow collection templates.

## 🧪 Testing & Debugging

```bash
# Test Webflow connection
npm run test:webflow

# Generate diary with debug output
npm run diary:generate

# Check logs for Webflow posting status
# Look for: "✅ Crypto Diary posted to Webflow successfully"
```

## 📋 Troubleshooting

### **"Connection failed"**
- Check your `WEBFLOW_API_TOKEN` is correct
- Verify the token has CMS access permissions

### **"Collection access failed"**  
- Check your `WEBFLOW_COLLECTION_ID` is correct
- Ensure collection exists and is published

### **"Failed to create entry"**
- Check collection field names match the code
- Verify you have write permissions
- Check Webflow API rate limits

### **"Site publish failed"**
- Check your site domains in the publish settings
- Verify publish permissions on your plan

## 🎉 Success!

Once configured, every crypto diary entry will automatically:
1. ✅ Generate rich analytical content
2. ✅ Post to Mastodon (if enabled)
3. ✅ Save to Webflow CMS collection  
4. ✅ Optionally publish your site live

Your crypto diary content workflow is now fully automated! 🚀