# Badge Icons - Firebase Storage Setup

## Overview
All badges currently use emoji icons. For production, you should upload custom SVG icons to Firebase Storage and update the badge library to use storage URLs.

## Current Status
- **Icons**: All badges use emoji/unicode characters
- **Total Badges**: ~150+ badges across all categories
- **Icon Format**: Emoji (temporary, for development)

## Badge Categories & Icon Counts

### Front of House (FOH) - 26 badges
- Service & Guest Experience: 10 badges
- Sales & Upsell: 8 badges
- Reliability & Professionalism: 8 badges
- Social & Brand: 6 badges

### Back of House (BOH) - 20 badges
- Skill & Execution: 8 badges
- Quality & Safety: 6 badges
- Team & Leadership: 7 badges
- Performance-Based: 5 badges

### Valet Driver - 19 badges
- Driving & Care: 7 badges
- Speed & Efficiency: 5 badges
- Guest Experience: 5 badges
- Reliability & Trust: 5 badges

### Diner - 25 badges
- Activity & Engagement: 7 badges
- Exploration: 6 badges
- Events & Community: 6 badges
- Credibility & Influence: 6 badges

### Management/Restaurant/Company - 15 badges
- Management Excellence: 8 badges
- Restaurant Achievement: 7 badges

## Icon Requirements

### File Format
- **Format**: SVG (Scalable Vector Graphics)
- **Size**: 64x64px recommended (scales well)
- **Color**: Should work on both light and dark backgrounds
- **Style**: Consistent design language across all badges

### Naming Convention
Use the badge ID as the filename:
- Example: `foh_five_star_service.svg`
- Example: `boh_grill_master.svg`
- Example: `valet_scratch_free_record.svg`
- Example: `diner_first_review.svg`

### Storage Structure
```
firebase-storage://badges/
  ├── foh/
  │   ├── foh_five_star_service.svg
  │   ├── foh_guest_favorite.svg
  │   └── ...
  ├── boh/
  │   ├── boh_grill_master.svg
  │   ├── boh_saute_specialist.svg
  │   └── ...
  ├── valet/
  │   ├── valet_scratch_free_record.svg
  │   └── ...
  ├── diner/
  │   ├── diner_first_review.svg
  │   └── ...
  └── management/
      ├── mgmt_excellence_award.svg
      └── ...
```

## Implementation Steps

1. **Design Icons**: Create unique SVG icons for each badge (150+ icons)
2. **Upload to Firebase Storage**: Upload all icons to `badges/{category}/{badgeId}.svg`
3. **Update Badge Library**: Replace emoji icons with Firebase Storage URLs
4. **Test**: Verify all badges display correctly

## Example Update

**Before (emoji):**
```javascript
foh_five_star_service: {
  icon: "⭐⭐⭐⭐⭐",
  // ...
}
```

**After (Firebase Storage URL):**
```javascript
foh_five_star_service: {
  icon: "https://firebasestorage.googleapis.com/v0/b/your-project.appspot.com/o/badges%2Ffoh%2Ffoh_five_star_service.svg?alt=media",
  // ...
}
```

## Badge Icon List (All Badges)

### Front of House (FOH)
1. foh_five_star_service
2. foh_guest_favorite
3. foh_hospitality_pro
4. foh_calm_under_fire
5. foh_crowd_controller
6. foh_table_whisperer
7. foh_vip_certified
8. foh_allergy_aware
9. foh_conflict_resolver
10. foh_service_recovery_hero
11. foh_top_seller
12. foh_check_booster
13. foh_dessert_champion
14. foh_beverage_upsell_king
15. foh_wine_confident
16. foh_cocktail_knowledgeable
17. foh_high_average_check
18. foh_merch_mover
19. foh_always_on_time
20. foh_shift_saver
21. foh_double_shift_warrior
22. foh_no_call_no_show_free
23. foh_management_trusted
24. foh_closing_captain
25. foh_trainer_certified
26. foh_new_hire_mentor
27. foh_guest_mentioned
28. foh_review_shoutout
29. foh_photo_featured
30. foh_social_share_star
31. foh_influencer_friendly
32. foh_brand_ambassador

### Back of House (BOH)
1. boh_grill_master
2. boh_saute_specialist
3. boh_fry_station_king
4. boh_knife_skills_certified
5. boh_plating_perfectionist
6. boh_speed_precision
7. boh_consistency_king
8. boh_high_volume_crusher
9. boh_zero_send_backs
10. boh_clean_station_certified
11. boh_health_code_hero
12. boh_allergy_safe_certified
13. boh_temperature_control_pro
14. boh_waste_reduction_champ
15. boh_line_leader
16. boh_expo_mvp
17. boh_calm_during_rush
18. boh_shift_anchor
19. boh_trainer_certified
20. boh_recipe_guardian
21. boh_systems_thinker
22. boh_top_rated_dish_creator
23. boh_menu_mvp
24. boh_seasonal_special_winner
25. boh_guest_favorite_dish
26. boh_five_star_kitchen_night

### Valet Driver
1. valet_scratch_free_record
2. valet_zero_incident_driver
3. valet_smooth_operator
4. valet_luxury_vehicle_certified
5. valet_manual_transmission_certified
6. valet_ev_certified
7. valet_exotic_car_trusted
8. valet_fastest_keys
9. valet_peak_hour_pro
10. valet_high_volume_handler
11. valet_flow_master
12. valet_line_optimizer
13. valet_polite_professional
14. valet_guest_complimented
15. valet_tip_magnet
16. valet_vip_driver
17. valet_calm_under_pressure
18. valet_always_on_time
19. valet_manager_trusted
20. valet_closing_shift_reliable
21. valet_trainer_driver
22. valet_safety_first

### Diner
1. diner_first_review
2. diner_10_reviews
3. diner_50_reviews
4. diner_100_reviews
5. diner_weekly_reviewer
6. diner_consistent_critic
7. diner_power_reviewer
8. diner_neighborhood_explorer
9. diner_city_hopper
10. diner_cuisine_collector
11. diner_hidden_gem_finder
12. diner_grand_opener_attendee
13. diner_soft_launch_insider
14. diner_event_attendee
15. diner_festival_goer
16. diner_tasting_night_regular
17. diner_popup_supporter
18. diner_charity_diner
19. diner_restaurant_week_finisher
20. diner_helpful_reviewer
21. diner_top_rated_reviewer
22. diner_trusted_taste
23. diner_influencer
24. diner_local_authority
25. diner_staff_endorsed

### Management/Restaurant/Company
1. mgmt_excellence_award
2. mgmt_team_builder
3. mgmt_revenue_growth
4. mgmt_guest_satisfaction_champion
5. mgmt_operational_excellence
6. mgmt_cost_control_master
7. mgmt_training_excellence
8. mgmt_safety_champion
9. restaurant_five_star_rating
10. restaurant_top_performer
11. restaurant_growth_champion
12. restaurant_guest_favorite
13. restaurant_innovation_award
14. restaurant_community_champion
15. restaurant_sustainability_leader
16. company_best_restaurant
17. company_excellence_award

## Notes
- All icons are currently emoji-based for quick development
- Custom SVG icons should be designed to match the app's design language
- Icons should be recognizable at small sizes (16px-64px)
- Consider creating icon sets in batches (FOH, BOH, Valet, Diner, Management)







