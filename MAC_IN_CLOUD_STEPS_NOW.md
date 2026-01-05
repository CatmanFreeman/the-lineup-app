# 🚀 MAC IN CLOUD - DO THIS NOW

## You're Ready! Let's Build Your App

---

## STEP 1: Open Terminal on Mac in Cloud

1. Open **Terminal** app (or use the terminal in your Mac in Cloud interface)

---

## STEP 2: Navigate to Your Project

```bash
# First, find where your project is
# If you cloned it before:
cd ~/client

# OR if it's somewhere else, navigate there
# OR clone it fresh:
cd ~
git clone YOUR_REPO_URL
cd client
```

**If you haven't cloned your repo yet, tell me your Git URL and I'll give you the exact command.**

---

## STEP 3: Pull Latest Code & Install

```bash
# Pull latest code
git pull

# Install dependencies
npm install
```

---

## STEP 4: Build React App

```bash
npm run build
```

**This might take 2-5 minutes. If you get a CSS error, let me know and we'll fix it quickly.**

---

## STEP 5: Sync to iOS

```bash
npx cap sync ios
```

---

## STEP 6: Open in Xcode

```bash
npx cap open ios
```

**Xcode should open automatically.**

---

## STEP 7: Configure Signing in Xcode

1. In Xcode, click on **App** in the left sidebar (under "App" folder)
2. Click **Signing & Capabilities** tab
3. Check **"Automatically manage signing"**
4. Select your **Team** (your Apple Developer account)
5. **Bundle Identifier** should be: `com.thelineup.app`

---

## STEP 8: Build & Archive

1. At the top of Xcode, next to the play button, click the device dropdown
2. Select **"Any iOS Device"** (NOT a simulator)
3. Go to menu: **Product** → **Archive**
4. Wait 5-15 minutes for the build

---

## STEP 9: Upload to App Store Connect

1. When archive finishes, a window called **"Organizer"** will open
2. Click **"Distribute App"**
3. Select **"App Store Connect"**
4. Click **Next**
5. Select **"Upload"**
6. Click **Next** → **Next** → **Upload**
7. Wait 10-30 minutes for upload

---

## STEP 10: Set Up App Store Connect (If Not Done)

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. **My Apps** → **+** → **New App**
   - Platform: **iOS**
   - Name: **The Lineup**
   - Bundle ID: **com.thelineup.app** (create if needed)
   - SKU: **thelineup-001**
3. Click **Create**

---

## STEP 11: Add Your 2 Partners as Testers

1. Go to **TestFlight** tab in App Store Connect
2. Wait for your build to finish processing (10-60 minutes - shows yellow "Processing")
3. Once it shows a green checkmark:
   - Go to **Internal Testing** section
   - Click **+** to add testers
   - Add your 2 partners' Apple ID emails
   - Select the build
   - Click **Start Testing**

**DONE! They'll get an email invitation.**

---

## 🆘 IF YOU GET STUCK:

**"No signing certificate"** → Make sure you're signed in to Xcode with your Apple Developer account

**"Bundle ID not available"** → Create it in App Store Connect first (Step 10)

**"Build fails"** → Share the error message and I'll help fix it

**"Can't find project"** → We'll clone it fresh

---

## 📋 QUICK CHECKLIST:

- [ ] Terminal open on Mac in Cloud
- [ ] Navigated to project folder
- [ ] `git pull` and `npm install` done
- [ ] `npm run build` successful
- [ ] `npx cap sync ios` done
- [ ] Xcode opened
- [ ] Signing configured
- [ ] Archive created
- [ ] Uploaded to App Store Connect
- [ ] App created in App Store Connect
- [ ] Partners added as testers

---

**Start with Step 1 and tell me when you're ready for the next step, or if you hit any errors!**

