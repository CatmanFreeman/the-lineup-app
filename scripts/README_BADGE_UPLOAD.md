# Badge Icon Upload Script

This script uploads SVG badge icons to Firebase Storage.

## Prerequisites

1. **Install Firebase Admin SDK**
   ```bash
   npm install firebase-admin
   ```

2. **Get Firebase Admin Credentials**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Select your project: `thelineupapp-88c99`
   - Go to **Project Settings** > **Service Accounts**
   - Click **"Generate New Private Key"**
   - Save the JSON file as `firebase-admin-key.json` in the project root
   - **IMPORTANT**: Add `firebase-admin-key.json` to `.gitignore` (never commit this file!)

3. **Prepare Your Badge Icons**
   - Create a `badges/` directory in the project root
   - Organize your SVG files like this:
     ```
     badges/
       ├── foh/
       │   ├── foh_five_star_service.svg
       │   ├── foh_guest_favorite.svg
       │   └── ...
       ├── boh/
       │   ├── boh_grill_master.svg
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

## Usage

1. **Place your SVG files** in the appropriate folders under `badges/`

2. **Run the upload script:**
   ```bash
   node scripts/uploadBadgeIcons.js
   ```

3. **The script will:**
   - Upload all SVG files to Firebase Storage
   - Organize them in `badges/{category}/{filename}.svg`
   - Make them publicly accessible
   - Generate a `badge-urls.json` file with all URLs
   - Skip files that already exist (won't overwrite)

## Output

After running, you'll get:
- ✅ All icons uploaded to Firebase Storage
- ✅ `badge-urls.json` file with all badge URLs mapped to badge IDs

Example `badge-urls.json`:
```json
{
  "foh_five_star_service": "https://storage.googleapis.com/thelineupapp-88c99.firebasestorage.app/badges/foh/foh_five_star_service.svg",
  "foh_guest_favorite": "https://storage.googleapis.com/thelineupapp-88c99.firebasestorage.app/badges/foh/foh_guest_favorite.svg",
  ...
}
```

## Next Steps

After uploading:

1. **Update badgeLibrary.js** to use the Firebase Storage URLs instead of emojis
2. **Replace the icon field** in each badge definition:
   ```javascript
   // Before (emoji):
   icon: "⭐⭐⭐⭐⭐",
   
   // After (Firebase Storage URL):
   icon: "https://storage.googleapis.com/thelineupapp-88c99.firebasestorage.app/badges/foh/foh_five_star_service.svg",
   ```

3. **Or use the badge-urls.json** to programmatically update all badges

## Troubleshooting

### "firebase-admin-key.json not found"
- Make sure you downloaded the service account key from Firebase Console
- Save it as `firebase-admin-key.json` in the project root
- Check that the file name is exactly `firebase-admin-key.json`

### "Permission denied" errors
- Make sure your Firebase project has Storage enabled
- Check that the service account has Storage Admin permissions
- Verify the storage bucket name matches: `thelineupapp-88c99.firebasestorage.app`

### "Directory not found"
- The script will create empty directories if they don't exist
- Add your SVG files to the created directories and run again

### Files not uploading
- Check that files are `.svg` format
- Verify file names match the badge IDs exactly (e.g., `foh_five_star_service.svg`)
- Check file permissions (should be readable)

## Security Note

⚠️ **Never commit `firebase-admin-key.json` to git!**

Add to `.gitignore`:
```
firebase-admin-key.json
```

This file contains sensitive credentials that could give full access to your Firebase project.







