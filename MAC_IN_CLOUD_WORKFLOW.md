# 💻 Mac in Cloud Workflow Guide

## Overview
This guide is specifically for developers working on Windows/Linux who need to build iOS apps using Mac in Cloud.

---

## Initial Setup (One Time)

### 1. Set Up Your Mac in Cloud Instance

1. **Connect to your Mac in Cloud account**
2. **Verify Xcode is installed:**
   ```bash
   xcodebuild -version
   # Should show Xcode 14+ version
   ```

3. **Install Command Line Tools:**
   ```bash
   xcode-select --install
   ```

4. **Install Node.js** (if not already installed):
   ```bash
   # Check version
   node --version
   
   # If not installed, download from nodejs.org or use Homebrew:
   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
   brew install node
   ```

5. **Install Git** (if not already installed):
   ```bash
   git --version
   # If not installed:
   brew install git
   ```

6. **Clone your repository:**
   ```bash
   cd ~
   git clone YOUR_REPO_URL
   cd client  # or your project folder name
   ```

---

## Development Workflow

### Daily Development (On Your Dell Laptop)

```bash
# 1. Make code changes in your editor
# 2. Test in browser
npm start

# 3. When ready to build for iOS:
npm run build

# 4. Commit and push
git add .
git commit -m "Your commit message"
git push origin main  # or your branch name
```

---

## iOS Build Workflow (On Mac in Cloud)

### Step 1: Connect to Mac in Cloud

1. Log into your Mac in Cloud account
2. Connect to your Mac instance (usually via RDP or web interface)

### Step 2: Pull Latest Code

```bash
# Navigate to your project
cd ~/client  # or wherever you cloned it

# Pull latest changes
git pull origin main  # or your branch name

# Install any new dependencies
npm install
```

### Step 3: Set Up Capacitor (First Time Only)

```bash
# Install Capacitor (if not already done)
npm install @capacitor/core @capacitor/cli @capacitor/ios

# Initialize Capacitor (if not already done)
npx cap init
# App name: The Lineup
# App ID: com.thelineup.app
# Web dir: build

# Add iOS platform (if not already done)
npx cap add ios
```

### Step 4: Build and Sync

```bash
# Make sure React app is built
npm run build

# Sync to iOS
npx cap sync ios
```

### Step 5: Open in Xcode and Build

```bash
# Open project in Xcode
npx cap open ios
```

**In Xcode:**
1. Wait for project to load
2. Select **Any iOS Device** from device dropdown (top toolbar)
3. Go to **Product** → **Archive**
4. Wait for archive to complete (5-15 minutes)
5. In Organizer window:
   - Click **Distribute App**
   - Select **App Store Connect**
   - Click **Next** → **Upload**
   - Wait for upload (10-30 minutes)

### Step 6: Configure in App Store Connect

1. Go to [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
2. Navigate to your app → **TestFlight** tab
3. Wait for processing (10-60 minutes)
4. Add testers and distribute

---

## Quick Build Script

Create a script to automate the build process on Mac in Cloud:

**Create `build-ios.sh` in your project root:**

```bash
#!/bin/bash

echo "🚀 Starting iOS build process..."

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build React app
echo "🔨 Building React app..."
npm run build

# Sync Capacitor
echo "🔄 Syncing Capacitor..."
npx cap sync ios

# Open Xcode
echo "📱 Opening Xcode..."
npx cap open ios

echo "✅ Done! Build in Xcode, then archive and upload."
```

**Make it executable:**
```bash
chmod +x build-ios.sh
```

**Run it:**
```bash
./build-ios.sh
```

---

## Troubleshooting Mac in Cloud

### Connection Issues
- **Slow connection:** Use a wired connection if possible, or ensure stable WiFi
- **Disconnections:** Save work frequently, use Git to preserve changes

### Xcode Issues
- **Xcode not found:** Make sure it's installed in Applications folder
- **License agreement:** Run `sudo xcodebuild -license accept`
- **Command Line Tools:** Run `xcode-select --install`

### Build Issues
- **"No such module":** Run `pod install` in `ios/App` directory (if using CocoaPods)
- **Signing errors:** Make sure you're signed in to Xcode with your Apple Developer account
- **Build fails:** Check Xcode console for specific errors

### Git Issues
- **Authentication:** Set up SSH keys or use HTTPS with personal access token
- **Large files:** Make sure `node_modules` and `ios/App/build` are in `.gitignore`

---

## Optimizing the Workflow

### 1. Use `.gitignore` Properly

Make sure your `.gitignore` includes:
```
node_modules/
ios/App/build/
ios/App/Pods/
.DS_Store
*.xcuserstate
*.xcworkspace/xcuserdata/
```

### 2. Keep Dependencies in Sync

Always run `npm install` on Mac in Cloud after pulling code to ensure dependencies match.

### 3. Version Control Capacitor Config

Make sure `capacitor.config.json` is committed to Git so it's the same on both machines.

### 4. Use Environment Variables

For different configs between dev and build:
- Use `.env` files (but don't commit secrets)
- Or use build-time environment variables

---

## Alternative: Automated CI/CD Builds

If you want to automate iOS builds without manually using Mac in Cloud each time, consider:

### GitHub Actions with Mac Runner

1. **Set up GitHub Actions workflow** (`.github/workflows/ios-build.yml`)
2. **Use Mac runner** (GitHub provides Mac runners)
3. **Automatically build and upload** on each push to main branch

**Benefits:**
- No need to manually connect to Mac in Cloud
- Automated builds on every commit
- Can trigger TestFlight uploads automatically

**Drawbacks:**
- More complex setup
- Requires GitHub Actions knowledge
- May have longer build times

---

## Cost Considerations

### Mac in Cloud Pricing
- Usually $20-50/month depending on plan
- Pay-per-use options available
- Check your current plan

### Alternative Options
1. **Rent a Mac Mini** - Physical Mac you can remote into
2. **Use a friend's Mac** - For occasional builds
3. **GitHub Actions** - Free for public repos, paid for private (but includes Mac runners)

---

## Quick Reference

**On Dell (Development):**
```bash
# Make changes → Test → Build → Commit → Push
npm run build
git add . && git commit -m "message" && git push
```

**On Mac in Cloud (Build):**
```bash
# Pull → Install → Build → Sync → Open Xcode
git pull
npm install
npm run build
npx cap sync ios
npx cap open ios
# Then archive and upload in Xcode
```

---

## Next Steps

1. ✅ Set up Mac in Cloud instance
2. ✅ Install Xcode and dependencies
3. ✅ Clone your repository
4. ✅ Follow initial Capacitor setup
5. ✅ Test the build workflow
6. ✅ Upload first build to TestFlight

---

**Need help?** Check the main `TESTFLIGHT_ALPHA_SETUP.md` guide for detailed steps.

