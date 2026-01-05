# Geocoding API Key Fix

## The Problem

The Google Geocoding API is returning:
```
REQUEST_DENIED - API keys with referer restrictions cannot be used with this API.
```

This means the API key has **HTTP referer restrictions** which prevent server-side usage.

## Solution Options

### Option 1: Fix Google API Key (RECOMMENDED)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services** → **Credentials**
3. Find your API key (`AIzaSyASxqfOLc8oU2wzMB93bAvq4vrJMKvuum0`)
4. Click **Edit**
5. Under **Application restrictions**, choose one of:
   - **None** (for server-side scripts)
   - **IP addresses** (add your server IP)
   - **Remove referer restrictions** if currently set
6. Under **API restrictions**, ensure **Geocoding API** is enabled
7. Save changes

### Option 2: Create a New Server-Side API Key

1. Create a new API key in Google Cloud Console
2. Set **Application restrictions** to **None** or **IP addresses**
3. Enable **Geocoding API** for this key
4. Update `scripts/geocodeAddress.js` with the new key

### Option 3: Use Alternative Geocoding Service

If you can't fix the Google key, we can use:
- **Mapbox Geocoding API** (free tier: 100k requests/month)
- **OpenCage Geocoding API** (free tier: 2,500 requests/day)
- **Nominatim (OpenStreetMap)** (free, but rate-limited)

## Why latlong.net Won't Work

According to their website:
- ❌ **No public API** - requires manual entry or paid batch service
- ❌ **Daily limits** - 10 free, 30 for registered users
- ❌ **Not scalable** - Can't automate 400 restaurants

## Recommended Action

**Fix the Google API key** - it's the most accurate and you already have it set up. Just need to remove referer restrictions for server-side use.





