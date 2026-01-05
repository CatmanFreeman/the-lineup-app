# 🚀 TestFlight Alpha Testing Setup Guide

## Overview
This guide will help you convert your React web app into a native iOS app using Capacitor and set it up for TestFlight Alpha testing.

---

## Prerequisites

1. **Apple Developer Account** ($99/year)
   - Sign up at [developer.apple.com](https://developer.apple.com)
   - Enroll in the Apple Developer Program

2. **Mac Access** (required for iOS builds)
   - **Option A:** Physical Mac computer
   - **Option B:** Mac in Cloud account (recommended if no physical Mac)
   - **Option C:** GitHub Actions / CI/CD (advanced, for automated builds)
   - Xcode 14+ installed
   - Command Line Tools installed

3. **Test Devices**
   - List of tester email addresses
   - iOS devices for testing (iPhone/iPad)

---

## 💻 **Using Mac in Cloud (No Physical Mac)**

If you're developing on Windows/Linux but need to build for iOS:

### **Recommended Workflow:**

1. **Develop on your Dell laptop** (Windows)
   - Write code, test in browser
   - Commit to Git (GitHub/GitLab/Bitbucket)

2. **Build on Mac in Cloud**
   - Connect to your Mac in Cloud instance
   - Pull code from Git
   - Run Capacitor build commands
   - Upload to TestFlight

### **Setup Mac in Cloud:**

1. **Connect to your Mac in Cloud instance**
2. **Install Xcode:**
   ```bash
   # Xcode should be pre-installed, but if not:
   # Download from Mac App Store (large download ~10GB)
   ```

3. **Install Node.js and npm:**
   ```bash
   # Check if installed
   node --version
   npm --version
   
   # If not, install via Homebrew or download from nodejs.org
   ```

4. **Install Git** (if not already installed):
   ```bash
   git --version
   ```

### **Workflow Steps:**

**On your Dell laptop:**
```bash
# 1. Make your code changes
# 2. Build React app
npm run build

# 3. Commit and push to Git
git add .
git commit -m "Prepare for iOS build"
git push
```

**On Mac in Cloud:**
```bash
# 1. Pull latest code
git pull

# 2. Install dependencies (if needed)
npm install

# 3. Sync Capacitor
npx cap sync ios

# 4. Open in Xcode
npx cap open ios

# 5. Build and upload (see Step 7 below)
```

### **Alternative: Use GitHub Actions (Advanced)**

You can automate iOS builds using GitHub Actions with a Mac runner. This eliminates the need to manually build on Mac in Cloud each time. See the "Automated Builds" section at the end of this guide.

---

## Step 1: Install Capacitor

Capacitor wraps your React app in a native iOS container, allowing it to run as a native app.

```bash
# Install Capacitor CLI and core packages
npm install @capacitor/core @capacitor/cli

# Install iOS platform
npm install @capacitor/ios

# Initialize Capacitor (if not already done)
npx cap init
```

When prompted:
- **App name:** The Lineup
- **App ID:** com.thelineup.app (or your preferred bundle ID)
- **Web dir:** build (for Create React App)

---

## Step 2: Configure Capacitor

### Update `capacitor.config.json` (or `capacitor.config.ts`)

```json
{
  "appId": "com.thelineup.app",
  "appName": "The Lineup",
  "webDir": "build",
  "bundledWebRuntime": false,
  "server": {
    "iosScheme": "thelineup",
    "androidScheme": "https"
  },
  "ios": {
    "contentInset": "automatic"
  },
  "plugins": {
    "SplashScreen": {
      "launchShowDuration": 2000,
      "launchAutoHide": true
    }
  }
}
```

---

## Step 3: Build Your React App

```bash
# Build the production version
npm run build
```

This creates the `build` folder that Capacitor will use.

---

## Step 4: Add iOS Platform

```bash
# Add iOS platform to your project
npx cap add ios

# Sync your web assets to iOS
npx cap sync ios
```

This creates an `ios` folder in your project with the native iOS app.

---

## Step 5: Configure iOS App in Xcode

1. **Open the project in Xcode:**
   ```bash
   npx cap open ios
   ```
   Or manually: Open `ios/App/App.xcworkspace` in Xcode

2. **Configure App Settings:**
   - Select the project in the left sidebar
   - Go to **Signing & Capabilities** tab
   - Select your **Team** (your Apple Developer account)
   - Set **Bundle Identifier** (e.g., `com.thelineup.app`)
   - Enable **Automatically manage signing**

3. **Configure App Icons & Launch Screen:**
   - Add your app icon to `ios/App/App/Assets.xcassets/AppIcon.appiconset`
   - Update launch screen if needed

4. **Set Build Version:**
   - In **General** tab, set:
     - **Version:** 1.0.0 (or your version)
     - **Build:** 1 (increment for each TestFlight upload)

---

## Step 6: Configure App Store Connect

1. **Go to App Store Connect:**
   - Visit [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Sign in with your Apple Developer account

2. **Create New App:**
   - Click **My Apps** → **+** → **New App**
   - Fill in:
     - **Platform:** iOS
     - **Name:** The Lineup
     - **Primary Language:** English
     - **Bundle ID:** Select the one you created (or create new)
     - **SKU:** A unique identifier (e.g., `thelineup-ios-001`)
     - **User Access:** Full Access

3. **App Information:**
   - Fill in app description, keywords, support URL, etc.
   - Upload screenshots (required for TestFlight)
   - Set privacy policy URL

---

## Step 7: Build Archive for TestFlight

### Option A: Build in Xcode (Recommended for first time)

1. **Select Device:**
   - In Xcode, select **Any iOS Device** from device dropdown (top toolbar)

2. **Archive:**
   - Go to **Product** → **Archive**
   - Wait for build to complete

3. **Upload to App Store Connect:**
   - In the Organizer window that opens:
     - Click **Distribute App**
     - Select **App Store Connect**
     - Click **Next**
     - Select **Upload**
     - Click **Next**
     - Review options, click **Upload**
   - Wait for upload to complete (can take 10-30 minutes)

### Option B: Build via Command Line (Faster for subsequent builds)

```bash
# Build archive
xcodebuild -workspace ios/App/App.xcworkspace \
  -scheme App \
  -configuration Release \
  -archivePath ios/App/build/App.xcarchive \
  archive

# Export for App Store
xcodebuild -exportArchive \
  -archivePath ios/App/build/App.xcarchive \
  -exportPath ios/App/build/export \
  -exportOptionsPlist ios/App/ExportOptions.plist
```

**Note:** You'll need to create `ExportOptions.plist` first (see below).

---

## Step 8: Create Export Options Plist

Create `ios/App/ExportOptions.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>method</key>
    <string>app-store</string>
    <key>teamID</key>
    <string>YOUR_TEAM_ID</string>
    <key>uploadBitcode</key>
    <false/>
    <key>uploadSymbols</key>
    <true/>
    <key>compileBitcode</key>
    <false/>
</dict>
</plist>
```

Replace `YOUR_TEAM_ID` with your Apple Developer Team ID (found in App Store Connect → Users and Access → Your name).

---

## Step 9: Set Up TestFlight

1. **Wait for Processing:**
   - After upload, go to App Store Connect → **TestFlight** tab
   - Wait for processing (usually 10-60 minutes)
   - You'll see a yellow "Processing" status until it's ready

2. **Add Internal Testers:**
   - Go to **Internal Testing** section
   - Click **+** to add testers
   - Add up to 100 internal testers (must be part of your App Store Connect team)
   - Select the build you want to test
   - Click **Start Testing**

3. **Add External Testers (Alpha/Beta):**
   - Go to **External Testing** section
   - Click **+** to create a new group (e.g., "Alpha Testers")
   - Add tester emails (up to 10,000 external testers)
   - Fill in **What to Test** notes
   - Select the build
   - Submit for Beta App Review (required for external testing)
   - Review usually takes 24-48 hours

---

## Step 10: Testers Install TestFlight

1. **Testers receive email invitation** (for external testers)
2. **Install TestFlight app** from App Store (if not already installed)
3. **Accept invitation** in TestFlight app
4. **Install your app** from TestFlight

---

## Step 11: Update Workflow (For Future Builds)

Every time you want to push a new build:

```bash
# 1. Make your code changes
# 2. Build React app
npm run build

# 3. Sync to iOS
npx cap sync ios

# 4. Open in Xcode
npx cap open ios

# 5. In Xcode:
#    - Increment Build number (General tab)
#    - Product → Archive
#    - Distribute App → Upload to App Store Connect
```

Or use command line:

```bash
npm run build
npx cap sync ios
# Then use xcodebuild commands from Step 7
```

---

## Important Notes

### ⚠️ **Bundle ID**
- Once you submit to App Store Connect, you **cannot change** the Bundle ID
- Make sure it's correct: `com.thelineup.app` (or your choice)

### ⚠️ **Version Numbers**
- **Version** (e.g., 1.0.0): User-facing version
- **Build** (e.g., 1, 2, 3): Must increment for each upload
- TestFlight requires each build number to be unique

### ⚠️ **App Store Review (External Testing)**
- External TestFlight builds require Beta App Review
- Review takes 24-48 hours
- Internal testing doesn't require review

### ⚠️ **Capacitor Plugins**
If you need native features, install Capacitor plugins:
```bash
npm install @capacitor/camera
npm install @capacitor/geolocation
npm install @capacitor/push-notifications
# etc.
```

Then sync:
```bash
npx cap sync ios
```

### ⚠️ **Firebase Configuration**
Your Firebase web config should work, but you may need to:
- Add iOS app to Firebase project
- Download `GoogleService-Info.plist`
- Add it to `ios/App/App/` in Xcode

---

## Troubleshooting

### Build Errors
- **"No signing certificate":** Make sure you're signed in to Xcode with your Apple Developer account
- **"Bundle ID not available":** Create it in App Store Connect first, or use a different one
- **"Provisioning profile issues":** Enable "Automatically manage signing" in Xcode

### TestFlight Issues
- **Build stuck processing:** Wait longer (can take up to 2 hours for first build)
- **Can't add external testers:** Make sure you've submitted for Beta App Review
- **Testers can't install:** Check that build is processed and assigned to testing group

### App Issues
- **White screen:** Check that `webDir` in `capacitor.config.json` matches your build folder
- **Network errors:** Make sure your API endpoints allow requests from the app
- **Firebase errors:** Ensure iOS app is configured in Firebase Console

---

## Quick Reference Commands

```bash
# Initial setup
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init
npm run build
npx cap add ios
npx cap sync ios

# Regular updates
npm run build
npx cap sync ios
npx cap open ios  # Then archive in Xcode

# Check status
npx cap doctor
```

---

## Next Steps After TestFlight Setup

1. **Monitor Feedback:**
   - Check TestFlight feedback in App Store Connect
   - Set up crash reporting (Firebase Crashlytics recommended)

2. **Iterate:**
   - Fix bugs based on tester feedback
   - Push new builds regularly
   - Update "What to Test" notes for each build

3. **Prepare for Production:**
   - Complete App Store listing
   - Prepare screenshots and marketing materials
   - Submit for App Store review when ready

---

## Resources

- [Capacitor iOS Documentation](https://capacitorjs.com/docs/ios)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [TestFlight Documentation](https://developer.apple.com/testflight/)
- [Apple Developer Forums](https://developer.apple.com/forums/)

---

**Good luck with your Alpha testing! 🎉**

