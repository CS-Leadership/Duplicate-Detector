# 📊 Review Duplicate Detection Tool

A powerful web-based tool for detecting duplicate outreach in review invitation data. Upload Excel/CSV files and automatically identify duplicate contact attempts using advanced pattern detection.

## 🌟 Features

### Detection Rules
1. **Both Email & Phone in Same Row** - Customers receiving both contact methods
2. **Same/Similar Customer Names** - Multiple contacts to same customer (with typo detection)
3. **Orphan Contact Patterns** - Contact info split across multiple rows
4. **Multiple Contacts in Single Cell** - Multiple phone numbers or emails in one field

### Key Capabilities
- ✅ Upload multiple Excel (.xlsx, .xls) or CSV files at once
- ✅ Adjustable fuzzy matching threshold (50-100%)
- ✅ Customizable exclusion patterns (auto-removes "Total" rows)
- ✅ Visual dashboards with charts and statistics
- ✅ Download results as Excel, PDF, or ZIP bundle
- ✅ Save and reload past analyses
- ✅ Remember user preferences
- ✅ Week-over-week trend visualization
- ✅ 100% client-side processing (no server needed, your data stays private)

## 🚀 Quick Start

### Option 1: Local Usage (No Installation)
1. Download all files to a folder
2. Open `index.html` in your web browser
3. Start uploading files!

### Option 2: Host on GitHub Pages (FREE)

#### Step 1: Create GitHub Account
- Go to [github.com](https://github.com) and sign up (it's free!)

#### Step 2: Create a New Repository
1. Click the "+" icon in top right → "New repository"
2. Name it `duplicate-detector` (or any name you like)
3. Make it **Public**
4. Check "Add a README file"
5. Click "Create repository"

#### Step 3: Upload Files
1. In your new repository, click "Add file" → "Upload files"
2. Drag and drop all these files:
   - `index.html`
   - `styles.css`
   - `app.js`
   - `duplicate-detector.js`
   - `README.md`
3. Click "Commit changes"

#### Step 4: Enable GitHub Pages
1. Go to repository "Settings" tab
2. Scroll down to "Pages" section in left sidebar
3. Under "Source", select "main" branch
4. Click "Save"
5. Wait 1-2 minutes

#### Step 5: Access Your Site
Your site will be live at: `https://YOUR-USERNAME.github.io/duplicate-detector/`

Example: `https://johnsmith.github.io/duplicate-detector/`

### Option 3: Host on Netlify (FREE)

#### Step 1: Create Netlify Account
- Go to [netlify.com](https://netlify.com) and sign up with GitHub

#### Step 2: Deploy via Drag & Drop
1. Log into Netlify
2. Drag all files (index.html, styles.css, app.js, duplicate-detector.js) into the deploy zone
3. Done! Your site is live in seconds

#### Step 3: Get Your URL
- Netlify provides a URL like: `random-name-12345.netlify.app`
- You can customize this in Site Settings

## 📖 How to Use

### 1. Upload Files
- Click the upload area or drag & drop Excel/CSV files
- Multiple files can be uploaded at once
- Supported formats: .xlsx, .xls, .csv

### 2. Configure Settings (Optional)
- **Fuzzy Match Threshold**: How strict name matching should be (80% default)
  - Higher = fewer false positives, might miss similar names
  - Lower = catch more variations, might flag non-duplicates
- **Exclude Terms**: Rows containing these terms will be removed (e.g., "Total, Summary")
- **Remember Settings**: Save your preferences for next time

### 3. Analyze
- Click "Analyze Files for Duplicates"
- Wait for processing (usually 1-5 seconds per file)
- View results on dashboard

### 4. Review Results
- **Summary Cards**: Quick overview of total reviews, duplicates, affected customers
- **Charts**: 
  - Weekly trend showing duplicate rates over time
  - Detection methods breakdown
- **Top Agents**: List of agents with highest duplicate rates
- **Download Options**:
  - Excel: All results in organized spreadsheet
  - PDF: Summary report
  - ZIP: Individual analysis files for each uploaded file

### 5. Past Analyses
- Previous 10 analyses are automatically saved
- Click "Load" to view past results
- Click "Delete" to remove old analyses

## 📊 Expected File Format

The tool auto-detects columns but expects these fields:

| Required Column | Variations Detected |
|----------------|---------------------|
| Agent Name | "User Name", "Agent", "User" |
| Customer Name | "Customer Name", "REVIEW_INVITE_CUSTOMER_NAME" |
| Phone Number | "Phone", "Phone Number", "REVIEW_INVITE_PHONE_NUMBER" |
| Email | "Email", "REVIEW_INVITE_EMAIL" |
| Date | "Date", "Day", "Date Sent" |

### Example File Structure:
```
User Name | Customer Name | Phone Number  | Email              | Date Sent
----------|---------------|---------------|--------------------|----------
John Doe  | Alice Smith   | +15551234567  |                    | 11/10/2025
John Doe  |               |               | alice@email.com    | 11/10/2025
Jane Smith| Bob Jones     | +15559876543  | bob@email.com      | 11/10/2025
```

In this example:
- Alice Smith would be flagged as duplicate (orphan pattern - phone and email split across rows)
- Bob Jones would NOT be flagged (single contact method is OK)

## 🔧 Technical Details

### Technologies Used
- **Pure HTML/CSS/JavaScript** - No frameworks required
- **SheetJS (xlsx.js)** - Excel file reading/writing
- **Chart.js** - Data visualization
- **jsPDF** - PDF generation
- **JSZip** - ZIP file creation
- **FileSaver.js** - File downloads

### Browser Support
- ✅ Chrome/Edge (recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ IE not supported

### Privacy & Security
- **100% client-side processing** - Files never leave your computer
- **No server uploads** - All analysis happens in your browser
- **No tracking** - No analytics or user tracking
- **Local storage only** - Past analyses saved to your browser only

## 🎯 Detection Method Details

### Rule 1: Both Email & Phone in Same Row
Flags rows where a single customer has both email AND phone number filled in, indicating they received both text and email for the same survey.

### Rule 2 & 3: Same/Similar Customer Names
Detects when the same customer name appears multiple times for the same agent. Uses fuzzy matching to catch typos (e.g., "Patricia" vs "Patrick").

### Rule 6: Orphan Contact Pattern ⭐ CRITICAL
Detects when a customer's name appears in one row, but additional contact information appears in subsequent rows WITHOUT the customer name repeated. This is the most common pattern causing duplicate outreach.

**Example:**
```
Agent      | Customer | Phone         | Email
-----------|----------|---------------|------------------
Mary Smith | John Doe | +15551234567  |
Mary Smith |          |               | john@email.com    ← Orphan row
```

Result: John Doe flagged as duplicate (received both phone AND email)

## 📝 Customization

### Adjusting Fuzzy Threshold
- **90-100%**: Very strict - only catches near-identical names
- **80-89%**: Recommended - catches common typos
- **70-79%**: Moderate - might catch some false positives
- **50-69%**: Loose - many false positives

### Adding Custom Exclusions
In the "Auto-exclude rows containing" field, add comma-separated terms:
- Example: `Total, Summary, Grand Total, Subtotal`
- Case-insensitive matching
- Leave blank to disable auto-exclusion

## 🆘 Troubleshooting

### "Could not identify required columns"
- Make sure your file has columns for Agent Name and Customer Name
- Check that column headers match expected variations

### Files not uploading
- Ensure files are .xlsx, .xls, or .csv format
- Check file isn't corrupted
- Try with a smaller file first

### Charts not displaying
- Clear browser cache and reload
- Make sure JavaScript is enabled
- Try a different browser

### Past analyses not loading
- Check browser's local storage isn't full
- Try clearing some old analyses
- Check browser privacy settings allow local storage

## 🔄 Updates & Maintenance

This tool runs entirely in your browser with no dependencies on external servers. Once deployed:
- No maintenance required
- No server costs
- Works offline (after initial page load)
- Will continue working indefinitely

## 📄 License

Free to use for any purpose. No attribution required.

## 🤝 Support

For issues or questions:
1. Check this README thoroughly
2. Try the troubleshooting section
3. Clear browser cache and try again

## 🎉 Credits

Built with love for accurate duplicate detection and data quality! 

---

**Version 1.0** | Last Updated: November 2025
