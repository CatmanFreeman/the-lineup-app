/**
 * Update Badge Library with Firebase Storage URLs
 * 
 * This script reads badge-urls.json and updates badgeLibrary.js
 * to replace emoji icons with Firebase Storage URLs.
 * 
 * Usage:
 *   node scripts/updateBadgeLibrary.js
 */

const fs = require('fs');
const path = require('path');

const badgeUrlsPath = path.join(__dirname, '..', 'badge-urls.json');
const badgeLibraryPath = path.join(__dirname, '..', 'src', 'utils', 'badgeLibrary.js');

if (!fs.existsSync(badgeUrlsPath)) {
  console.error('❌ Error: badge-urls.json not found!');
  console.error('   Please run uploadBadgeIcons.js first to generate the URL mapping.');
  process.exit(1);
}

const badgeUrls = JSON.parse(fs.readFileSync(badgeUrlsPath, 'utf8'));
let badgeLibraryCode = fs.readFileSync(badgeLibraryPath, 'utf8');

console.log('🔄 Updating badge library with Firebase Storage URLs...\n');

let updated = 0;
let notFound = 0;

// Update each badge icon
for (const [badgeId, url] of Object.entries(badgeUrls)) {
  // Find the badge definition in the code
  // Look for pattern: badgeId: { ... icon: "..." ... }
  const badgePattern = new RegExp(
    `(${badgeId.replace(/_/g, '\\_')}:\\s*{[^}]*icon:\\s*")([^"]+)(")`,
    's'
  );
  
  if (badgePattern.test(badgeLibraryCode)) {
    badgeLibraryCode = badgeLibraryCode.replace(
      badgePattern,
      `$1${url}$3`
    );
    console.log(`✅ Updated ${badgeId}`);
    updated++;
  } else {
    // Try alternative pattern (might be on separate lines)
    const altPattern = new RegExp(
      `(${badgeId.replace(/_/g, '\\_')}:\\s*{[\\s\\S]*?icon:\\s*")([^"]+)(")`,
      's'
    );
    
    if (altPattern.test(badgeLibraryCode)) {
      badgeLibraryCode = badgeLibraryCode.replace(
        altPattern,
        `$1${url}$3`
      );
      console.log(`✅ Updated ${badgeId}`);
      updated++;
    } else {
      console.log(`⚠️  Badge not found in library: ${badgeId}`);
      notFound++;
    }
  }
}

// Write updated code back
fs.writeFileSync(badgeLibraryPath, badgeLibraryCode, 'utf8');

console.log('\n' + '='.repeat(50));
console.log('📊 Update Summary');
console.log('='.repeat(50));
console.log(`✅ Updated: ${updated}`);
console.log(`⚠️  Not found: ${notFound}`);
console.log('='.repeat(50));

if (updated > 0) {
  console.log('\n🎉 Badge library updated successfully!');
  console.log('\n📝 Next steps:');
  console.log('   1. Review the changes in src/utils/badgeLibrary.js');
  console.log('   2. Test that badges display correctly');
  console.log('   3. Commit the changes');
} else {
  console.log('\n⚠️  No badges were updated. Check that badge IDs match.');
}







