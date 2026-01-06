#!/bin/bash

echo "🔧 Fixing Podfile for Capacitor 8..."

cd ios/App

# Check if Podfile exists
if [ ! -f "Podfile" ]; then
  echo "❌ Podfile not found!"
  exit 1
fi

# Show current Podfile
echo "📄 Current Podfile:"
cat Podfile | grep -i "platform :ios"

# Fix deployment target to 15.0
echo ""
echo "🔨 Setting iOS deployment target to 15.0..."
sed -i '' 's/platform :ios.*/platform :ios, "15.0"/' Podfile

# Also fix any IPHONEOS_DEPLOYMENT_TARGET if present
sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = .*/IPHONEOS_DEPLOYMENT_TARGET = 15.0/' Podfile

# Show updated Podfile
echo ""
echo "✅ Updated Podfile:"
cat Podfile | grep -i "platform :ios"

echo ""
echo "📦 Installing pods..."
pod install

cd ../..

echo ""
echo "✅ Done! Now run: npx cap sync ios"

