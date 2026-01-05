# Getting ALL New Orleans Restaurants

Since New Orleans is your launch city, let's get comprehensive restaurant coverage!

## Option 1: Automated Fetch (BEST - Gets Hundreds!)

This will automatically search all neighborhoods and get 500-1000+ restaurants.

### Step 1: Get Google Places API Key

See `GET_GOOGLE_API_KEY.md` for detailed instructions.

**Quick version:**
1. Go to https://console.cloud.google.com/
2. Create project → Enable "Places API" → Create API Key
3. Copy the key

### Step 2: Run the Comprehensive Fetch

```bash
node scripts/fetchAllNewOrleansRestaurants.js YOUR_API_KEY
```

**What it does:**
- Searches 10+ neighborhoods (French Quarter, Garden District, CBD, etc.)
- Searches by cuisine type (Creole, Cajun, Seafood, etc.)
- Searches by category (Fine Dining, Casual, etc.)
- Gets full details for each restaurant
- Removes duplicates
- Creates `new-orleans-all-restaurants.json`

**Expected results:**
- 500-1000+ unique restaurants
- All with addresses, coordinates, phone, website, ratings
- Ready to upload

### Step 3: Upload to Firebase

```bash
node scripts/addRestaurants.js new-orleans-all-restaurants.json
```

**Time:** This will take 10-30 minutes depending on how many restaurants (adds them one by one to avoid rate limits)

## Option 2: Manual List (Backup)

If you can't get an API key right now, I can create a larger manual list (50-100 restaurants). Just let me know!

## Cost Estimate

- **One-time fetch**: ~$5-10 (one-time cost)
- **After that**: Free (data is stored in Firebase)
- **Google Free Tier**: $200/month credit (covers this easily)

## What You'll Get

The comprehensive fetch will include:
- ✅ All major neighborhoods
- ✅ All cuisine types
- ✅ Fine dining to casual
- ✅ Famous restaurants to hidden gems
- ✅ Complete data (address, phone, website, ratings, coordinates)

## Ready?

1. Get your Google Places API key (5 minutes)
2. Run the fetch script (10-20 minutes)
3. Upload to Firebase (10-30 minutes)

**Total time: ~30-60 minutes for 500-1000 restaurants!**

Want me to help you get the API key, or do you want to try it yourself first?







