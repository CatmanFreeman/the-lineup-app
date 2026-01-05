# How to Get Google Places API Key

## Quick Steps

1. **Go to Google Cloud Console**
   - Visit: https://console.cloud.google.com/

2. **Create or Select a Project**
   - Click "Select a project" → "New Project"
   - Name it (e.g., "Lineup App")
   - Click "Create"

3. **Enable Places API**
   - Go to "APIs & Services" → "Library"
   - Search for "Places API"
   - Click on it → Click "Enable"

4. **Create API Key**
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - Copy the key (it will look like: `AIzaSy...`)

5. **Restrict the Key (Recommended)**
   - Click on the key you just created
   - Under "API restrictions", select "Restrict key"
   - Choose "Places API"
   - Click "Save"

## Cost Information

- **Free Tier**: $200 credit/month
- **Places API**: 
  - Text Search: $32 per 1,000 requests
  - Place Details: $17 per 1,000 requests
- **For New Orleans**: Fetching ~500-1000 restaurants = ~$5-10 one-time cost
- **After that**: Free to use the data (no ongoing costs)

## Security Note

- **Don't commit your API key to git!**
- Add to `.gitignore`: `GOOGLE_PLACES_API_KEY`
- Or use environment variables

## Once You Have the Key

Run:
```bash
node scripts/fetchAllNewOrleansRestaurants.js YOUR_API_KEY
```

This will fetch hundreds of restaurants automatically!







