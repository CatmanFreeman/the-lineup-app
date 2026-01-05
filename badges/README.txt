BADGE ICONS FOLDER
==================

This folder contains SVG badge icons that will be uploaded to Firebase Storage.

FOLDER STRUCTURE:
-----------------
foh/          - Front of House employee badges
boh/          - Back of House employee badges
valet/        - Valet driver badges
diner/        - Diner badges
management/   - Management/Restaurant/Company badges

HOW TO USE:
-----------
1. Place your SVG files in the appropriate subfolder
2. File names must match badge IDs exactly (e.g., foh_five_star_service.svg)
3. Run: node scripts/uploadBadgeIcons.js
4. The script will upload all files to Firebase Storage

FILE NAMING:
-----------
✅ Correct: foh_five_star_service.svg
❌ Wrong:   Five Star Service.svg
❌ Wrong:   foh_five_star_service.png

See BADGE_FOLDER_SETUP.md for detailed instructions.







