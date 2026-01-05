# 🚀 GET TO ALPHA - FAST TRACK

## Goal: Get your app into TestFlight so you can send it to your 2 partners

---

## STEP 1: Install Capacitor (On Your Dell - 2 minutes)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init
```

**When prompted:**
- App name: `The Lineup`
- App ID: `com.thelineup.app`
- Web dir: `build`

---

## STEP 2: Build Your React App (On Your Dell - 1 minute)

```bash
npm run build
```

---

## STEP 3: Add iOS Platform (On Your Dell - 1 minute)

```bash
npx cap add ios
npx cap sync ios
```

---

## STEP 4: Connect to Mac in Cloud & Build (On Mac in Cloud - 15 minutes)

1. **Connect to your Mac in Cloud**
2. **Pull your code:**
   ```bash
   cd ~/client  # or wherever your project is
   git pull
   npm install
   npm run build
   npx cap sync ios
   ```

3. **Open in Xcode:**
   ```bash
   npx cap open ios
   ```

4. **In Xcode:**
   - Select **Any iOS Device** (top toolbar)
   - Go to **Signing & Capabilities** tab
   - Select your **Team** (Apple Developer account)
   - Set **Bundle Identifier:** `com.thelineup.app`
   - Enable **Automatically manage signing**

5. **Build & Archive:**
   - **Product** → **Archive**
   - Wait for build (5-15 minutes)

6. **Upload:**
   - In Organizer window: **Distribute App**
   - Select **App Store Connect**
   - Click **Upload**
   - Wait (10-30 minutes)

---

## STEP 5: Set Up App Store Connect (One Time - 10 minutes)

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **My Apps** → **+** → **New App**
   - Platform: iOS
   - Name: The Lineup
   - Bundle ID: `com.thelineup.app` (create if needed)
   - SKU: `thelineup-001`

3. **Wait for build to process** (10-60 minutes)

---

## STEP 6: Add Your 2 Partners as Testers (5 minutes)

1. Go to **TestFlight** tab
2. **Internal Testing** section
3. Click **+** to add testers
4. Add your 2 partners' Apple ID emails
5. Select the build
6. Click **Start Testing**

**DONE!** They'll get an email and can install via TestFlight app.

---

## ⚠️ REQUIREMENTS CHECKLIST

Before you start, make sure you have:

- [ ] Apple Developer Account ($99/year) - [Sign up here](https://developer.apple.com)
- [ ] Mac in Cloud account (you have this ✅)
- [ ] Your 2 partners' Apple ID email addresses
- [ ] Code pushed to Git (so Mac in Cloud can pull it)

---

## 🐛 IF SOMETHING BREAKS

**"No signing certificate"** → Sign in to Xcode with your Apple Developer account

**"Bundle ID not available"** → Create it in App Store Connect first

**"Build stuck processing"** → Wait up to 2 hours for first build

**"Can't add testers"** → Make sure build finished processing (green checkmark)

---

## ⏱️ TOTAL TIME: ~45 minutes (mostly waiting for builds)

**You can do steps 1-3 on your Dell right now. Then jump to Mac in Cloud for step 4.**

---

**Let's get you to Alpha! 🎯**

