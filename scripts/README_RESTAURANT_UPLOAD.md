# Add Restaurants to Firebase

This script adds restaurants to the Firestore `restaurants` collection.

## Quick Start

### Option 1: Use Sample Restaurants (Built-in)

```bash
node scripts/addRestaurants.js
```

This will add 2 sample restaurants defined in the script.

### Option 2: Use a JSON File

1. **Create a JSON file** with your restaurants (see `restaurants.example.json` for format)

2. **Run the script:**
   ```bash
   node scripts/addRestaurants.js restaurants.json
   ```

## JSON File Format

Each restaurant should have:

```json
{
  "name": "Restaurant Name",           // REQUIRED
  "lat": 40.7128,                      // REQUIRED (latitude)
  "lng": -74.0060,                     // REQUIRED (longitude)
  "phone": "(555) 123-4567",          // Optional
  "website": "https://example.com",   // Optional
  "address": {                         // Optional
    "line1": "123 Main Street",
    "line2": "",
    "city": "New York",
    "state": "NY",
    "zip": "10001"
  },
  "cuisines": ["American", "Bistro"], // Optional (array)
  "liveRating": 4.5,                  // Optional (number)
  "companyId": "company-123",         // Optional (if part of a company)
  "imageURL": "https://...",          // Optional (logo/image URL)
  "hoursOfOperation": {                // Optional
    "Monday": {
      "openTime": "11:00",
      "openMeridiem": "AM",
      "closeTime": "10:00",
      "closeMeridiem": "PM"
    },
    // ... other days
  },
  "preferences": {                     // Optional
    "patioSeating": true,
    "oceanView": true,
    "outdoorSeating": true
  }
}
```

## Required Fields

- `name` - Restaurant name
- `lat` - Latitude (number, -90 to 90)
- `lng` - Longitude (number, -180 to 180)

## Optional Fields

- `phone` - Phone number
- `website` - Website URL
- `address` - Address object
- `cuisines` - Array of cuisine types
- `liveRating` - Rating (number)
- `companyId` - Company ID if part of a company
- `imageURL` - Logo/image URL
- `hoursOfOperation` - Hours for each day
- `preferences` - Restaurant preferences (oceanView, patioSeating, etc.)

## Features

- ✅ Validates restaurant data before adding
- ✅ Skips duplicates (by name + location)
- ✅ Shows progress and summary
- ✅ Handles errors gracefully

## Example

```bash
# Add sample restaurants
node scripts/addRestaurants.js

# Add restaurants from JSON file
node scripts/addRestaurants.js my-restaurants.json
```

## Getting Coordinates (lat/lng)

You can get coordinates from:
- Google Maps: Right-click → "What's here?" → See coordinates
- Google Places API
- Geocoding services

## Tips

1. **Batch Upload**: Create a JSON file with all restaurants and upload at once
2. **Validation**: The script validates all data before adding
3. **Duplicates**: Script automatically skips restaurants that already exist
4. **Company ID**: Set `companyId` if restaurants belong to a company







