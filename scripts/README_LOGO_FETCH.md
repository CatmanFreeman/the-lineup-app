# Fetch Restaurant Logos

This script automatically fetches restaurant logos using Google Places API and uploads them to Firebase Storage.

## Quick Start

### Fetch logos for all restaurants without logos:
```bash
node scripts/fetchRestaurantLogos.js
```

### Fetch logo for a specific restaurant:
```bash
node scripts/fetchRestaurantLogos.js [restaurantId]
```

## How It Works

1. **Searches Google Places API** for each restaurant by name and address
2. **Gets place details** including photos
3. **Downloads the first photo** (usually the logo/main photo)
4. **Uploads to Firebase Storage** at `restaurants/{restaurantId}/logo_{timestamp}.jpg`
5. **Updates restaurant document** with `imageURL` and `logoURL` fields

## Features

- ✅ Only fetches logos for restaurants that don't have one
- ✅ Rate limiting (200ms between requests) to avoid API limits
- ✅ Automatic upload to Firebase Storage
- ✅ Makes images publicly accessible
- ✅ Updates restaurant documents automatically

## Notes

- Uses Google Places API (requires API key with Places API enabled)
- Photos are limited to 400px width for faster loading
- Images are cached in Firebase Storage with 1-year cache control
- If a restaurant isn't found in Google Places, it will be skipped

## API Costs

- Google Places API charges per request
- Text Search: ~$32 per 1000 requests
- Place Details: ~$17 per 1000 requests
- Photo: ~$7 per 1000 requests
- **Total per restaurant: ~$0.056** (about 6 cents)

For 400 restaurants: ~$22.40 total

## Troubleshooting

If you get API errors:
1. Check that Places API is enabled in Google Cloud Console
2. Verify API key has Places API permissions
3. Check API quota limits
4. Ensure billing is enabled on Google Cloud project







