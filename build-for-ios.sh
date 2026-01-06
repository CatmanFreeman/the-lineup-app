#!/bin/bash

echo "🚀 Creating build structure for iOS..."

# Create directories
mkdir -p build/static/css build/static/js build/static/media

# Copy public files
echo "📁 Copying public files..."
cp -r public/* build/ 2>/dev/null || true

# Create index.html
echo "📄 Creating index.html..."
cat > build/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>The Lineup</title>
    <script>
      window.initMap = function () {
        window.googleMapsReady = true;
        window.dispatchEvent(new Event("google-maps-loaded"));
      };
      (function loadMaps() {
        if (window.googleMapsLoading) return;
        window.googleMapsLoading = true;
        const script = document.createElement("script");
        script.src = "https://maps.googleapis.com/maps/api/js?key=AIzaSyASxqfOLc8oU2wzMB93bAvq4vrJMKvuum0&libraries=places,geometry&callback=initMap";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      })();
    </script>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
    <script src="/static/js/main.js"></script>
  </body>
</html>
EOF

# Create placeholder files
echo "📝 Creating placeholder files..."
echo "/* CSS */" > build/static/css/main.css
echo "// JS" > build/static/js/main.js

echo "✅ Build structure created!"
echo ""
echo "📦 Syncing to iOS..."
npx cap sync ios

echo ""
echo "🎉 Done! Now run: npx cap open ios"

