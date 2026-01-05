/**
 * Upload Badge Icons to Firebase Storage
 * 
 * This script uploads SVG badge icons from a local directory to Firebase Storage.
 * 
 * Usage:
 *   1. Place your SVG icons in the badges/ directory with this structure:
 *      badges/
 *        ├── foh/
 *        │   ├── foh_five_star_service.svg
 *        │   └── ...
 *        ├── boh/
 *        ├── valet/
 *        ├── diner/
 *        └── management/
 * 
 *   2. Install Firebase Admin SDK (if not already installed):
 *      npm install firebase-admin
 * 
 *   3. Set up Firebase Admin credentials:
 *      - Go to Firebase Console > Project Settings > Service Accounts
 *      - Click "Generate New Private Key"
 *      - Save the JSON file as firebase-admin-key.json in the project root
 *      - Add firebase-admin-key.json to .gitignore
 * 
 *   4. Run the script:
 *      node scripts/uploadBadgeIcons.js
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'firebase-admin-key.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error('❌ Error: firebase-admin-key.json not found!');
  console.error('   Please download it from Firebase Console > Project Settings > Service Accounts');
  console.error('   Save it as firebase-admin-key.json in the project root');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'thelineupapp-88c99.firebasestorage.app'
});

const bucket = admin.storage().bucket();

// Badge categories and their folder names
const CATEGORIES = {
  foh: 'foh',
  boh: 'boh',
  valet: 'valet',
  diner: 'diner',
  management: 'management'
};

// Expected badge IDs for each category (for validation)
const EXPECTED_BADGES = {
  foh: [
    'foh_five_star_service',
    'foh_guest_favorite',
    'foh_hospitality_pro',
    'foh_calm_under_fire',
    'foh_crowd_controller',
    'foh_table_whisperer',
    'foh_vip_certified',
    'foh_allergy_aware',
    'foh_conflict_resolver',
    'foh_service_recovery_hero',
    'foh_top_seller',
    'foh_check_booster',
    'foh_dessert_champion',
    'foh_beverage_upsell_king',
    'foh_wine_confident',
    'foh_cocktail_knowledgeable',
    'foh_high_average_check',
    'foh_merch_mover',
    'foh_always_on_time',
    'foh_shift_saver',
    'foh_double_shift_warrior',
    'foh_no_call_no_show_free',
    'foh_management_trusted',
    'foh_closing_captain',
    'foh_trainer_certified',
    'foh_new_hire_mentor',
    'foh_guest_mentioned',
    'foh_review_shoutout',
    'foh_photo_featured',
    'foh_social_share_star',
    'foh_influencer_friendly',
    'foh_brand_ambassador'
  ],
  boh: [
    'boh_grill_master',
    'boh_saute_specialist',
    'boh_fry_station_king',
    'boh_knife_skills_certified',
    'boh_plating_perfectionist',
    'boh_speed_precision',
    'boh_consistency_king',
    'boh_high_volume_crusher',
    'boh_zero_send_backs',
    'boh_clean_station_certified',
    'boh_health_code_hero',
    'boh_allergy_safe_certified',
    'boh_temperature_control_pro',
    'boh_waste_reduction_champ',
    'boh_line_leader',
    'boh_expo_mvp',
    'boh_calm_during_rush',
    'boh_shift_anchor',
    'boh_trainer_certified',
    'boh_recipe_guardian',
    'boh_systems_thinker',
    'boh_top_rated_dish_creator',
    'boh_menu_mvp',
    'boh_seasonal_special_winner',
    'boh_guest_favorite_dish',
    'boh_five_star_kitchen_night'
  ],
  valet: [
    'valet_scratch_free_record',
    'valet_zero_incident_driver',
    'valet_smooth_operator',
    'valet_luxury_vehicle_certified',
    'valet_manual_transmission_certified',
    'valet_ev_certified',
    'valet_exotic_car_trusted',
    'valet_fastest_keys',
    'valet_peak_hour_pro',
    'valet_high_volume_handler',
    'valet_flow_master',
    'valet_line_optimizer',
    'valet_polite_professional',
    'valet_guest_complimented',
    'valet_tip_magnet',
    'valet_vip_driver',
    'valet_calm_under_pressure',
    'valet_always_on_time',
    'valet_manager_trusted',
    'valet_closing_shift_reliable',
    'valet_trainer_driver',
    'valet_safety_first'
  ],
  diner: [
    'diner_first_review',
    'diner_10_reviews',
    'diner_50_reviews',
    'diner_100_reviews',
    'diner_weekly_reviewer',
    'diner_consistent_critic',
    'diner_power_reviewer',
    'diner_neighborhood_explorer',
    'diner_city_hopper',
    'diner_cuisine_collector',
    'diner_hidden_gem_finder',
    'diner_grand_opener_attendee',
    'diner_soft_launch_insider',
    'diner_event_attendee',
    'diner_festival_goer',
    'diner_tasting_night_regular',
    'diner_popup_supporter',
    'diner_charity_diner',
    'diner_restaurant_week_finisher',
    'diner_helpful_reviewer',
    'diner_top_rated_reviewer',
    'diner_trusted_taste',
    'diner_influencer',
    'diner_local_authority',
    'diner_staff_endorsed'
  ],
  management: [
    'mgmt_excellence_award',
    'mgmt_team_builder',
    'mgmt_revenue_growth',
    'mgmt_guest_satisfaction_champion',
    'mgmt_operational_excellence',
    'mgmt_cost_control_master',
    'mgmt_training_excellence',
    'mgmt_safety_champion',
    'restaurant_five_star_rating',
    'restaurant_top_performer',
    'restaurant_growth_champion',
    'restaurant_guest_favorite',
    'restaurant_innovation_award',
    'restaurant_community_champion',
    'restaurant_sustainability_leader',
    'company_best_restaurant',
    'company_excellence_award'
  ]
};

/**
 * Upload a single file to Firebase Storage
 */
async function uploadFile(localPath, storagePath) {
  try {
    const file = bucket.file(storagePath);
    
    // Check if file already exists
    const [exists] = await file.exists();
    if (exists) {
      console.log(`   ⚠️  Already exists: ${storagePath}`);
      return null;
    }
    
    await bucket.upload(localPath, {
      destination: storagePath,
      metadata: {
        contentType: 'image/svg+xml',
        cacheControl: 'public, max-age=31536000', // Cache for 1 year
      },
    });
    
    // Make file publicly accessible
    await file.makePublic();
    
    // Get public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
    
    return publicUrl;
  } catch (error) {
    console.error(`   ❌ Error uploading ${storagePath}:`, error.message);
    throw error;
  }
}

/**
 * Upload all icons for a category
 */
async function uploadCategory(categoryKey, categoryFolder) {
  const badgesDir = path.join(__dirname, '..', 'badges', categoryFolder);
  
  if (!fs.existsSync(badgesDir)) {
    console.log(`⚠️  Directory not found: ${badgesDir}`);
    console.log(`   Creating directory...`);
    fs.mkdirSync(badgesDir, { recursive: true });
    console.log(`   ✅ Created. Please add your SVG files and run again.`);
    return { uploaded: 0, skipped: 0, errors: 0 };
  }
  
  const files = fs.readdirSync(badgesDir);
  const svgFiles = files.filter(f => f.endsWith('.svg'));
  
  if (svgFiles.length === 0) {
    console.log(`⚠️  No SVG files found in ${badgesDir}`);
    return { uploaded: 0, skipped: 0, errors: 0 };
  }
  
  console.log(`\n📁 Category: ${categoryKey.toUpperCase()}`);
  console.log(`   Found ${svgFiles.length} SVG file(s)`);
  
  let uploaded = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const fileName of svgFiles) {
    const badgeId = fileName.replace('.svg', '');
    const localPath = path.join(badgesDir, fileName);
    const storagePath = `badges/${categoryFolder}/${fileName}`;
    
    try {
      const url = await uploadFile(localPath, storagePath);
      if (url) {
        console.log(`   ✅ ${badgeId} → ${url}`);
        uploaded++;
      } else {
        skipped++;
      }
    } catch (error) {
      console.error(`   ❌ ${badgeId}: ${error.message}`);
      errors++;
    }
  }
  
  // Check for missing badges
  const expectedBadges = EXPECTED_BADGES[categoryKey] || [];
  const uploadedBadgeIds = svgFiles.map(f => f.replace('.svg', ''));
  const missingBadges = expectedBadges.filter(id => !uploadedBadgeIds.includes(id));
  
  if (missingBadges.length > 0) {
    console.log(`\n   ⚠️  Missing badges (${missingBadges.length}):`);
    missingBadges.forEach(id => console.log(`      - ${id}.svg`));
  }
  
  return { uploaded, skipped, errors };
}

/**
 * Generate a mapping file with all badge URLs
 */
async function generateBadgeUrlMapping() {
  console.log('\n📝 Generating badge URL mapping...');
  
  const mapping = {};
  
  for (const [categoryKey, categoryFolder] of Object.entries(CATEGORIES)) {
    const badgesDir = path.join(__dirname, '..', 'badges', categoryFolder);
    
    if (!fs.existsSync(badgesDir)) continue;
    
    const files = fs.readdirSync(badgesDir);
    const svgFiles = files.filter(f => f.endsWith('.svg'));
    
    for (const fileName of svgFiles) {
      const badgeId = fileName.replace('.svg', '');
      const storagePath = `badges/${categoryFolder}/${fileName}`;
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${storagePath}`;
      
      mapping[badgeId] = publicUrl;
    }
  }
  
  const mappingPath = path.join(__dirname, '..', 'badge-urls.json');
  fs.writeFileSync(mappingPath, JSON.stringify(mapping, null, 2));
  
  console.log(`   ✅ Saved to ${mappingPath}`);
  console.log(`   Total badges: ${Object.keys(mapping).length}`);
  
  return mapping;
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 Starting badge icon upload...\n');
  
  const stats = {
    uploaded: 0,
    skipped: 0,
    errors: 0
  };
  
  // Upload all categories
  for (const [categoryKey, categoryFolder] of Object.entries(CATEGORIES)) {
    const result = await uploadCategory(categoryKey, categoryFolder);
    stats.uploaded += result.uploaded;
    stats.skipped += result.skipped;
    stats.errors += result.errors;
  }
  
  // Generate URL mapping
  await generateBadgeUrlMapping();
  
  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 Upload Summary');
  console.log('='.repeat(50));
  console.log(`✅ Uploaded: ${stats.uploaded}`);
  console.log(`⏭️  Skipped (already exist): ${stats.skipped}`);
  console.log(`❌ Errors: ${stats.errors}`);
  console.log('='.repeat(50));
  
  if (stats.errors === 0) {
    console.log('\n🎉 All icons uploaded successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Review badge-urls.json for all URLs');
    console.log('   2. Update badgeLibrary.js to use these URLs');
    console.log('   3. Replace emoji icons with Firebase Storage URLs');
  } else {
    console.log('\n⚠️  Some errors occurred. Please review and fix.');
  }
}

// Run the script
main()
  .then(() => {
    console.log('\n✅ Script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });







