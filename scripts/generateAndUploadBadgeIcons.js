/**
 * Generate Badge Icons and Upload to Firebase Storage
 * 
 * This script:
 * 1. Generates SVG icon files for all badges
 * 2. Uploads them to Firebase Storage
 * 3. Updates badgeLibrary.js with the Firebase URLs
 * 
 * Usage:
 *   node scripts/generateAndUploadBadgeIcons.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin-key.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: firebase-admin-key.json not found!');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'thelineupapp-88c99.firebasestorage.app'
});

const bucket = admin.storage().bucket();

// Import badge library to get all badges
const badgeLibraryPath = path.join(__dirname, '..', 'src', 'utils', 'badgeLibrary.js');
const badgeLibraryCode = fs.readFileSync(badgeLibraryPath, 'utf8');

// Extract all badge definitions - improved regex
const badges = [];
const badgePattern = /(\w+):\s*{\s*id:\s*"([^"]+)"[\s\S]*?name:\s*"([^"]+)"[\s\S]*?icon:\s*"([^"]+)"[\s\S]*?color:\s*"([^"]+)"/g;
let match;

while ((match = badgePattern.exec(badgeLibraryCode)) !== null) {
  const [, , id, name, emojiIcon, color] = match;
  badges.push({ id, name, emojiIcon, color });
}

// Determine category from badge ID
function getCategory(badgeId) {
  if (badgeId.startsWith('foh_')) return 'foh';
  if (badgeId.startsWith('boh_')) return 'boh';
  if (badgeId.startsWith('valet_')) return 'valet';
  if (badgeId.startsWith('diner_')) return 'diner';
  if (badgeId.startsWith('mgmt_') || badgeId.startsWith('restaurant_') || badgeId.startsWith('company_')) return 'management';
  // Legacy badges
  if (badgeId.startsWith('review_') || badgeId.startsWith('checkin_') || badgeId.startsWith('sushi_') || badgeId.startsWith('mexican_') || badgeId.startsWith('photo_') || badgeId.startsWith('helpful_')) return 'diner';
  if (badgeId.startsWith('tenure_') || badgeId.startsWith('top_performer') || badgeId.startsWith('perfect_attendance') || badgeId.startsWith('sommelier') || badgeId.startsWith('wine_expert') || badgeId.startsWith('menu_master') || badgeId.startsWith('shift_') || badgeId.startsWith('night_owl') || badgeId.startsWith('employee_of_month') || badgeId.startsWith('outstanding_service')) return 'foh';
  return 'foh'; // default
}

/**
 * Generate SVG icon from emoji
 */
function generateSVGIcon(badgeId, emojiIcon, color, name) {
  // Clean emoji for use in SVG
  const emoji = emojiIcon;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="grad-${badgeId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:1" />
      <stop offset="100%" style="stop-color:${color}dd;stop-opacity:1" />
    </linearGradient>
  </defs>
  <circle cx="32" cy="32" r="30" fill="url(#grad-${badgeId})" stroke="${color}" stroke-width="2"/>
  <text x="32" y="42" font-size="28" text-anchor="middle" fill="white" font-family="Arial, sans-serif">${emoji}</text>
</svg>`;
}

/**
 * Upload a file to Firebase Storage
 */
async function uploadToFirebase(localPath, storagePath) {
  try {
    const file = bucket.file(storagePath);
    
    // Check if exists
    const [exists] = await file.exists();
    if (exists) {
      return null; // Skip if exists
    }
    
    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        contentType: 'image/svg+xml',
        cacheControl: 'public, max-age=31536000',
      },
    });
    
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
  } catch (error) {
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Generating and uploading badge icons...\n');
  console.log(`Found ${badges.length} badges\n`);
  
  // Ensure badges directory exists
  const badgesDir = path.join(__dirname, '..', 'badges');
  if (!fs.existsSync(badgesDir)) {
    fs.mkdirSync(badgesDir, { recursive: true });
  }
  
  const categoryDirs = ['foh', 'boh', 'valet', 'diner', 'management'];
  categoryDirs.forEach(cat => {
    const dir = path.join(badgesDir, cat);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  const urlMap = {};
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process each badge
  for (const badge of badges) {
    const category = getCategory(badge.id);
    const fileName = `${badge.id}.svg`;
    const localPath = path.join(badgesDir, category, fileName);
    const storagePath = `badges/${category}/${fileName}`;
    
    try {
      // Generate SVG
      const svg = generateSVGIcon(badge.id, badge.emojiIcon, badge.color, badge.name);
      fs.writeFileSync(localPath, svg, 'utf8');
      
      // Upload to Firebase
      const url = await uploadToFirebase(localPath, storagePath);
      
      if (url) {
        urlMap[badge.id] = url;
        console.log(`✅ ${badge.id} → ${url}`);
        uploaded++;
      } else {
        // File exists, get existing URL
        urlMap[badge.id] = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
        console.log(`⏭️  ${badge.id} (already exists)`);
        skipped++;
      }
    } catch (error) {
      console.error(`❌ ${badge.id}: ${error.message}`);
      errors++;
    }
  }
  
  // Save URL mapping
  const urlMapPath = path.join(__dirname, '..', 'badge-urls.json');
  fs.writeFileSync(urlMapPath, JSON.stringify(urlMap, null, 2));
  console.log(`\n✅ Saved URL mapping to badge-urls.json`);
  
  // Update badgeLibrary.js with URLs
  console.log('\n🔄 Updating badgeLibrary.js with Firebase URLs...');
  let updatedCode = badgeLibraryCode;
  let updatedCount = 0;
  
  for (const [badgeId, url] of Object.entries(urlMap)) {
    // Find and replace icon field
    const pattern = new RegExp(
      `(${badgeId.replace(/_/g, '\\_')}:\\s*{[\\s\\S]*?icon:\\s*")([^"]+)(")`,
      's'
    );
    
    if (pattern.test(updatedCode)) {
      updatedCode = updatedCode.replace(pattern, `$1${url}$3`);
      updatedCount++;
    }
  }
  
  fs.writeFileSync(badgeLibraryPath, updatedCode, 'utf8');
  console.log(`✅ Updated ${updatedCount} badges in badgeLibrary.js`);
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary');
  console.log('='.repeat(50));
  console.log(`✅ Uploaded: ${uploaded}`);
  console.log(`⏭️  Skipped (already exist): ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📝 Updated badgeLibrary.js: ${updatedCount} badges`);
  console.log('='.repeat(50));
  console.log('\n🎉 Done! All badge icons are now in Firebase Storage!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });

