# How to Add Restaurants - SUPER SIMPLE GUIDE

## What This Does

The script takes restaurant information and adds it to Firebase so it shows up on your map.

## What You Need

For each restaurant, you need:
1. **Name** - The restaurant's name
2. **Address** - Where it is
3. **Coordinates** (lat/lng) - The exact location on the map

## Step-by-Step: Adding Your First Restaurant

### Step 1: Pick a Restaurant

Choose any restaurant you want to add. For example:
- "Joe's Pizza" in New York
- "The Coffee Shop" in your city
- Any restaurant you know

### Step 2: Get the Address

You need:
- Street address
- City
- State
- ZIP code

Example:
- Address: "123 Main Street"
- City: "New York"
- State: "NY"
- ZIP: "10001"

### Step 3: Get the Coordinates (This is the tricky part!)

You need the **latitude** and **longitude** (lat/lng) - these are numbers that tell the map exactly where the restaurant is.

#### Easy Way: Use Google Maps

1. Go to [Google Maps](https://www.google.com/maps)
2. Search for your restaurant (or the address)
3. **Right-click** on the red pin
4. Click **"What's here?"**
5. You'll see coordinates at the bottom like: `40.7128, -74.0060`
   - First number = **lat** (latitude)
   - Second number = **lng** (longitude)

**Example:**
- Search: "Joe's Pizza New York"
- Right-click the pin → "What's here?"
- See: `40.7128, -74.0060`
- So: `lat: 40.7128`, `lng: -74.0060`

### Step 4: Create a JSON File

I'll help you create this! Just tell me:
- Restaurant name
- Address
- City, State, ZIP
- (I can help you get the coordinates)

### Step 5: Run the Script

Once you have the JSON file:
```bash
node scripts/addRestaurants.js your-restaurants.json
```

## Example: Adding "Joe's Pizza"

Let's say you want to add "Joe's Pizza" at "123 Main St, New York, NY 10001"

1. **Get coordinates from Google Maps:**
   - Search "123 Main St New York"
   - Right-click → "What's here?"
   - Get: `40.7128, -74.0060`

2. **Create JSON file:**
```json
[
  {
    "name": "Joe's Pizza",
    "address": {
      "line1": "123 Main Street",
      "city": "New York",
      "state": "NY",
      "zip": "10001"
    },
    "lat": 40.7128,
    "lng": -74.0060,
    "phone": "(555) 123-4567"
  }
]
```

3. **Save as `my-restaurants.json`**

4. **Run:**
```bash
node scripts/addRestaurants.js my-restaurants.json
```

## Quick Questions

**Q: Do I need to pick a specific city?**
A: No! You can add restaurants from anywhere. Just get their address and coordinates.

**Q: How many restaurants can I add?**
A: As many as you want! Put them all in one JSON file.

**Q: What if I don't know the phone number?**
A: That's optional! You can leave it out or use `null`.

**Q: Do I need all the fields?**
A: No! Only `name`, `lat`, and `lng` are required. Everything else is optional.

## Need Help?

Just tell me:
1. Restaurant name
2. Address (or city/state if you want me to help find it)
3. I'll create the JSON file for you!







