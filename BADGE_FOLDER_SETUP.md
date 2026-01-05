# Where to Create the Badges Folder - Step by Step

## 📍 Location: In Your LOCAL Project Folder

The `badges/` folder should be created **in your project root** (same level as `package.json`, `src/`, `public/`, etc.)

## 🗂️ Your Project Structure Should Look Like This:

```
C:\Users\Catman Freeman\Desktop\client\
  ├── badges/                    ← CREATE THIS FOLDER HERE
  │   ├── foh/
  │   ├── boh/
  │   ├── valet/
  │   ├── diner/
  │   └── management/
  ├── node_modules/
  ├── public/
  ├── scripts/
  ├── src/
  ├── firebase-admin-key.json    ← You already have this!
  ├── package.json
  ├── README.md
  └── ... (other files)
```

## ✅ Step-by-Step Instructions:

### Step 1: Navigate to Your Project Root
You're already there! It's:
```
C:\Users\Catman Freeman\Desktop\client
```

### Step 2: Create the Main Badges Folder
Create a new folder called `badges` in the project root.

**In Windows File Explorer:**
1. Open `C:\Users\Catman Freeman\Desktop\client`
2. Right-click in empty space
3. Select "New" → "Folder"
4. Name it: `badges`

### Step 3: Create Subfolders Inside `badges/`
Inside the `badges` folder, create these 5 subfolders:

1. `foh` (Front of House)
2. `boh` (Back of House)
3. `valet` (Valet Drivers)
4. `diner` (Diners)
5. `management` (Management/Restaurant/Company)

**Your final structure should be:**
```
badges/
  ├── foh/
  ├── boh/
  ├── valet/
  ├── diner/
  └── management/
```

### Step 4: Add Your SVG Files
Place your SVG icon files in the appropriate folders:

- **FOH badges** → `badges/foh/`
  - Example: `foh_five_star_service.svg`
  - Example: `foh_guest_favorite.svg`
  - etc.

- **BOH badges** → `badges/boh/`
  - Example: `boh_grill_master.svg`
  - Example: `boh_saute_specialist.svg`
  - etc.

- **Valet badges** → `badges/valet/`
  - Example: `valet_scratch_free_record.svg`
  - etc.

- **Diner badges** → `badges/diner/`
  - Example: `diner_first_review.svg`
  - etc.

- **Management badges** → `badges/management/`
  - Example: `mgmt_excellence_award.svg`
  - etc.

## 📝 Important Notes:

1. **File Names Must Match Badge IDs Exactly**
   - Badge ID: `foh_five_star_service`
   - File name: `foh_five_star_service.svg` ✅
   - File name: `Five Star Service.svg` ❌ (wrong!)

2. **Files Must Be SVG Format**
   - ✅ `foh_five_star_service.svg`
   - ❌ `foh_five_star_service.png` (wrong format)

3. **The Script Will Upload to Firebase**
   - You create the folders and files locally
   - The script (`uploadBadgeIcons.js`) will upload them to Firebase Storage
   - You don't need to do anything in Firebase Console

## 🎯 Quick Visual Guide:

```
Your Computer (Local)                    Firebase Storage (Cloud)
─────────────────────                    ────────────────────────
badges/                                  (empty - script will create)
  ├── foh/                               badges/
  │   └── foh_five_star_service.svg  →     ├── foh/
  ├── boh/                                    │   └── foh_five_star_service.svg
  ├── valet/                                  ├── boh/
  ├── diner/                                  ├── valet/
  └── management/                             ├── diner/
                                              └── management/
```

## ✅ Checklist:

- [ ] Created `badges/` folder in project root
- [ ] Created 5 subfolders (foh, boh, valet, diner, management)
- [ ] Added SVG files with correct names
- [ ] All files are `.svg` format
- [ ] File names match badge IDs exactly

## 🚀 Once You Have Your Icons Ready:

Run the upload script:
```bash
node scripts/uploadBadgeIcons.js
```

The script will:
1. Find all SVG files in your `badges/` folder
2. Upload them to Firebase Storage
3. Make them publicly accessible
4. Generate a `badge-urls.json` file with all the URLs

## ❓ Still Confused?

If you're not sure where your project root is:
- Look for `package.json` - that's your project root
- Look for `src/` folder - that's your project root
- Look for `firebase-admin-key.json` - that's your project root

The `badges/` folder should be right next to these files!







