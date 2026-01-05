# ⚡ TestFlight Quick Start Checklist

## Pre-Flight Checklist

- [ ] Apple Developer Account ($99/year) - [Sign up here](https://developer.apple.com)
- [ ] Mac access (physical Mac OR Mac in Cloud account) with Xcode installed
- [ ] List of alpha tester email addresses ready

**Note:** If you're on Windows/Linux, use Mac in Cloud. See `MAC_IN_CLOUD_WORKFLOW.md` for details.

---

## Installation Steps (First Time Only)

```bash
# 1. Install Capacitor
npm install @capacitor/core @capacitor/cli @capacitor/ios

# 2. Initialize Capacitor
npx cap init
# App name: The Lineup
# App ID: com.thelineup.app
# Web dir: build

# 3. Build your React app
npm run build

# 4. Add iOS platform
npx cap add ios

# 5. Sync to iOS
npx cap sync ios
```

---

## Xcode Setup (First Time Only)

1. **Open project:**
   ```bash
   npx cap open ios
   ```

2. **In Xcode:**
   - Select project → **Signing & Capabilities**
   - Select your **Team**
   - Enable **Automatically manage signing**
   - Set **Bundle Identifier:** `com.thelineup.app`

3. **Set version:**
   - **Version:** 1.0.0
   - **Build:** 1

---

## App Store Connect Setup (First Time Only)

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **My Apps** → **+** → **New App**
3. Fill in:
   - Platform: iOS
   - Name: The Lineup
   - Bundle ID: (select or create `com.thelineup.app`)
   - SKU: `thelineup-ios-001`

---

## Upload First Build

1. **In Xcode:**
   - Select **Any iOS Device** (top toolbar)
   - **Product** → **Archive**
   - Wait for build

2. **In Organizer:**
   - Click **Distribute App**
   - Select **App Store Connect**
   - Click **Upload**
   - Wait 10-30 minutes

3. **In App Store Connect:**
   - Go to **TestFlight** tab
   - Wait for processing (10-60 minutes)

---

## Add Testers

### Internal Testers (No Review Needed)
1. **TestFlight** → **Internal Testing**
2. Click **+** → Add team members
3. Select build → **Start Testing**

### External Testers (Alpha - Requires Review)
1. **TestFlight** → **External Testing**
2. Click **+** → Create group "Alpha Testers"
3. Add tester emails
4. Fill in "What to Test"
5. Submit for **Beta App Review** (24-48 hours)

---

## Update Build (For Each New Version)

```bash
# 1. Make code changes
# 2. Build
npm run build

# 3. Sync
npx cap sync ios

# 4. Open Xcode
npx cap open ios

# 5. In Xcode:
#    - Increment Build number
#    - Product → Archive
#    - Distribute App → Upload
```

---

## Common Issues

| Issue | Solution |
|-------|----------|
| "No signing certificate" | Sign in to Xcode with Apple Developer account |
| "Bundle ID not available" | Create it in App Store Connect first |
| Build stuck processing | Wait up to 2 hours for first build |
| White screen in app | Check `webDir: "build"` in capacitor.config.json |

---

## Need Help?

See full guide: `TESTFLIGHT_ALPHA_SETUP.md`

---

**Estimated Time:** 
- First setup: 2-3 hours
- Each update: 15-30 minutes

