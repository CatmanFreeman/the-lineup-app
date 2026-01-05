# Adding Restaurants - Complete Beginner's Guide

## What You're Doing

You're adding restaurant information to your app's database (Firebase) so they show up on the map.

## Two Ways to Do This

### Method 1: Interactive Script (EASIEST!)

I created a script that asks you questions step-by-step:

```bash
node scripts/createRestaurantJSON.js
```

It will ask you:
- Restaurant name
- Address
- Coordinates
- Phone, website, etc. (optional)

Then it creates the JSON file for you automatically!

### Method 2: Manual JSON File

Create a JSON file yourself (I'll help you with this too).

## Getting Coordinates - The Only Tricky Part

You need **latitude** and **longitude** numbers. Here's the easiest way:

### Using Google Maps:

1. **Go to:** https://www.google.com/maps
2. **Search** for your restaurant (or just the address)
3. **Right-click** on the red pin that appears
4. **Click** "What's here?"
5. **See the coordinates** at the bottom (like: `40.7128, -74.0060`)
   - First number = **lat** (latitude)
   - Second number = **lng** (longitude)

**Example:**
- Search: "Pizza Hut Times Square"
- Right-click pin → "What's here?"
- See: `40.7580, -73.9855`
- So: `lat: 40.7580`, `lng: -73.9855`

## Step-by-Step Example

Let's say you want to add "Tony's Pizza" in New York:

### Step 1: Get the Info
- Name: "Tony's Pizza"
- Address: "123 Broadway, New York, NY 10001"
- Get coordinates from Google Maps: `40.7128, -74.0060`

### Step 2: Use the Interactive Script

```bash
node scripts/createRestaurantJSON.js
```

Answer the questions:
- Restaurant name: `Tony's Pizza`
- Street address: `123 Broadway`
- City: `New York`
- State: `NY`
- ZIP: `10001`
- Latitude: `40.7128`
- Longitude: `-74.0060`
- Phone: `(555) 123-4567` (or skip)
- Website: (skip)
- Cuisines: `Italian, Pizza`
- Rating: `4.5` (or skip)

### Step 3: Save and Upload

The script creates `restaurants.json` for you. Then run:

```bash
node scripts/addRestaurants.js restaurants.json
```

Done! ✅

## What City Should You Pick?

**Any city you want!** You can add restaurants from:
- Your local area
- A specific city you're targeting
- Multiple cities (just add them all to the same file)
- Anywhere in the world

## Common Questions

**Q: Do I need to add restaurants one at a time?**
A: No! You can add as many as you want in one file.

**Q: What if I don't know the phone number?**
A: That's fine! Just skip it or leave it blank.

**Q: Can I add restaurants from different cities?**
A: Yes! Add them all to the same JSON file.

**Q: How do I know if it worked?**
A: The script will tell you! It shows "✅ Added" for each restaurant.

**Q: What if I make a mistake?**
A: You can run the script again - it will skip duplicates.

## Need Help Right Now?

Just tell me:
1. **Restaurant name**
2. **Address** (or city/state)
3. I'll help you get the coordinates and create the file!

Or use the interactive script - it guides you through everything!







