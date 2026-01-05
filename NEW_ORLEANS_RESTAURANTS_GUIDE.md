# Adding New Orleans Restaurants

I've created two options for you:

## Option 1: Manual List (READY TO USE!)

I've created a file with **15 famous New Orleans restaurants** already set up:

**File:** `new-orleans-restaurants-manual.json`

This includes:
- Commander's Palace
- Antoine's Restaurant
- Galatoire's Restaurant
- Arnaud's Restaurant
- Brennan's Restaurant
- Cafe du Monde
- Acme Oyster House
- Mother's Restaurant
- Dooky Chase's Restaurant
- Willie Mae's Scotch House
- Cochon
- Emeril's New Orleans
- Drago's Seafood Restaurant
- The Court of Two Sisters
- K-Paul's Louisiana Kitchen

**To use it:**
```bash
node scripts/addRestaurants.js new-orleans-restaurants-manual.json
```

✅ **This is ready to go right now!** No API key needed.

## Option 2: Fetch More Restaurants (Requires Google API Key)

If you want to fetch MORE restaurants automatically:

### Step 1: Get Google Places API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable "Places API"
4. Create credentials (API Key)
5. Copy the API key

### Step 2: Run the Fetch Script

```bash
node scripts/fetchNewOrleansRestaurants.js YOUR_API_KEY
```

This will:
- Search for restaurants in New Orleans
- Get their details (address, phone, coordinates, etc.)
- Create a JSON file ready to upload
- Find 50+ restaurants automatically

### Step 3: Upload to Firebase

```bash
node scripts/addRestaurants.js new-orleans-restaurants.json
```

## Quick Start (Easiest!)

Just run this right now:

```bash
node scripts/addRestaurants.js new-orleans-restaurants-manual.json
```

This will add 15 famous New Orleans restaurants to your Firebase database!

## What's Included in the Manual List

Each restaurant has:
- ✅ Name
- ✅ Full address
- ✅ Coordinates (lat/lng)
- ✅ Phone number
- ✅ Website (where available)
- ✅ Cuisine types
- ✅ Ratings

All ready to upload!

## Need More Restaurants?

1. **Use the manual list first** (15 restaurants)
2. **Then use the fetch script** to get more (requires API key)
3. **Or tell me specific restaurants** and I'll add them to the file

## Ready to Go!

The manual list is ready right now. Just run:

```bash
node scripts/addRestaurants.js new-orleans-restaurants-manual.json
```

That's it! 🎉







