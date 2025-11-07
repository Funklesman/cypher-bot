# Cyberpunk Flipbook Integration Guide for Webflow

## 🚀 Quick Setup

### 1. **Head Code** (Custom Code → Head)
Copy the entire contents of `webflow-flipbook-head.html` into your page's custom code HEAD section.

### 2. **Body Code** (Custom Code → Body)
Copy the entire contents of `webflow-flipbook-body.html` into your page's custom code BODY section.

### 3. **HTML Structure Required**
Make sure your Webflow page has this structure:

```html
<div class="flipbook"></div>

<div class="cms-data" style="display: none;">
  <!-- Your CMS Collection List goes here -->
  <div class="w-dyn-list">
    <div class="w-dyn-items">
      <div class="w-dyn-item">
        <div class="cms-title">Diary Entry Title</div>
        <div class="cms-date">Date Field</div>
        <div class="cms-content">Rich Text Content</div>
      </div>
      <!-- More items... -->
    </div>
  </div>
</div>
```

## 🎨 Key Features

### ✨ **Cyberpunk Styling**
- Dark gradient backgrounds with neon accents
- Glowing text effects and borders
- Animated scanning effects on covers
- Glitch animation on page turns
- Courier New monospace font for that terminal feel

### 📖 **Smart Text Splitting**
- Automatically splits long content across multiple pages
- Maintains formatting and paragraph structure
- Shows "continued" indicators for multi-page entries
- Preserves rich text formatting (bold, italic, etc.)

### 🎮 **Interactive Features**
- Smooth page flip animations
- Keyboard navigation (left/right arrows)
- Page numbering
- Loading animation
- Error handling and debugging

### 📱 **Responsive Design**
- Adapts to smaller screens
- Maintains aspect ratio
- Touch-friendly on mobile devices

## 🔧 Customization Options

### **Colors**
```css
/* Main accent color (currently yellow) */
color: #fef735;

/* Secondary accent (currently cyan) */
color: #00ffff;

/* Background gradient */
background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%);
```

### **Page Dimensions**
```css
.flipbook {
  width: 800px;   /* Total width (2 pages) */
  height: 500px;  /* Page height */
}

.flipbook .page {
  width: 400px;   /* Single page width */
  height: 500px;  /* Single page height */
}
```

### **Typography**
```css
.flipbook .page {
  font-family: 'Courier New', monospace; /* Cyberpunk feel */
  font-size: 13px;
  line-height: 1.6;
}
```

## 🐛 Troubleshooting

### **Common Issues:**

1. **"No .flipbook element found"**
   - Make sure you have `<div class="flipbook"></div>` on your page

2. **"No CMS items found"**
   - Check that your CMS collection has the class `cms-data`
   - Ensure individual items have class `w-dyn-item`
   - Verify field classes: `cms-title`, `cms-date`, `cms-content`

3. **"Turn.js not loaded"**
   - Check browser console for 404 errors
   - Ensure internet connection for CDN
   - Try refreshing the page

4. **Pages appear vertical instead of flipbook**
   - Check if Turn.js initialized properly
   - Look for JavaScript errors in console
   - Ensure jQuery loaded before Turn.js

### **Debug Mode:**
Open browser console (F12) to see detailed logging:
- 🔄 Initialization messages
- 📚 Number of entries found
- 📝 Processing status for each entry
- 📖 Page generation count
- ✨ Successful initialization

## 🎯 Performance Tips

1. **Limit CMS Items**: For best performance, limit to 50-100 diary entries
2. **Optimize Images**: Compress images in rich text content
3. **Text Length**: Very long entries will create many pages - consider summary excerpts
4. **Mobile Testing**: Test on actual mobile devices for touch interactions

## 🚀 Advanced Customization

### **Add Custom Fonts**
```html
<!-- In HEAD section -->
<link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700&display=swap" rel="stylesheet">
```

```css
.flipbook .page {
  font-family: 'Orbitron', 'Courier New', monospace;
}
```

### **Custom Page Effects**
```css
.flipbook .page::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: url('data:image/svg+xml,<svg>...</svg>');
  opacity: 0.1;
  pointer-events: none;
}
```

### **Sound Effects** (Optional)
```javascript
// Add to the turning/turned events
when: {
  turning: function(event, page, view) {
    // new Audio('/path/to/page-turn.mp3').play();
  }
}
```

## 📝 CMS Field Setup

### **Required Fields:**
- **Title**: Text field (maps to `.cms-title`)
- **Date**: Date field (maps to `.cms-date`) 
- **Content**: Rich Text field (maps to `.cms-content`)

### **Optional Enhancements:**
- **Featured**: Checkbox to highlight special entries
- **Tags**: Multi-reference for categorization
- **Author**: Text field for author attribution

---

**Need help?** Check the browser console for detailed error messages and debugging information. The code includes extensive logging to help identify any issues.