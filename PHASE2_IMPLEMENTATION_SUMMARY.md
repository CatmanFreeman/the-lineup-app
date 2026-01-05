# Phase 2 Implementation Summary
## Availability Engine MVP

### ✅ Completed Features

#### 1. **Slot Generation** (`availabilityEngineService.js`)
- **15-minute intervals** within service hours
- Respects dining duration (last slot allows time to finish)
- Automatically adjusts for restaurant opening/closing times

#### 2. **Load Mapping**
- Builds load map from existing reservations in ledger
- Accounts for dining duration (reservations "cover" multiple slots)
- Calculates covers per 15-minute slot
- Filters out cancelled/completed reservations

#### 3. **Capacity Caps**
- **Default**: `maxCoversPer15Min = floor(totalSeats * 0.35)`
- Protects kitchen from overbooking
- Configurable per restaurant

#### 4. **Slot Scoring & Tiering**
- **RECOMMENDED**: Best option (plenty of capacity, low load)
- **AVAILABLE**: Good option (moderate capacity, acceptable load)
- **FLEXIBLE**: Limited capacity (requires flexibility)

#### 5. **Confidence Levels**
- **HIGH**: Strong confidence in availability
- **MED**: Moderate confidence
- **LOW**: Lower confidence (same-day, high load, etc.)

### 📊 Slot Data Structure

```javascript
{
  startAt: Date,
  endAt: Date,
  startAtISO: "2024-01-15T19:00:00Z",
  covers: 12,                    // Current covers in this slot
  availableCovers: 5,            // Available covers
  loadPercentage: 70.5,          // Load percentage (0-100)
  utilizationPercentage: 24.0,   // Utilization of total seats
  tier: "RECOMMENDED" | "AVAILABLE" | "FLEXIBLE",
  confidence: "HIGH" | "MED" | "LOW",
  minutesUntil: 120,             // Minutes until slot
  metadata: {
    maxCoversPerSlot: 17,
    totalSeats: 50,
    avgDiningDuration: 90
  }
}
```

### 🔧 Key Functions

#### `computeAvailability()`
Main function to compute availability for a restaurant on a given date.

```javascript
const slots = await computeAvailability({
  restaurantId: "restaurant-123",
  date: "2024-01-15",
  restaurantData: {
    totalSeats: 50,
    hoursOfOperation: { ... }
  },
  options: {
    maxCoversPer15Min: 17,  // Optional override
    avgDiningDuration: 90  // Optional override
  }
});
```

#### `getAvailabilityForDateRange()`
Get availability for multiple dates.

```javascript
const availability = await getAvailabilityForDateRange({
  restaurantId: "restaurant-123",
  startDate: "2024-01-15",
  endDate: "2024-01-20",
  restaurantData: { ... },
  options: { ... }
});
// Returns: { "2024-01-15": [...slots], "2024-01-16": [...slots], ... }
```

#### `checkSlotAvailability()`
Check if a specific time slot is available for a party size.

```javascript
const result = await checkSlotAvailability({
  restaurantId: "restaurant-123",
  requestedTime: "2024-01-15T19:00:00Z",
  partySize: 4,
  restaurantData: { ... },
  options: { ... }
});
// Returns: { available: true, slot: {...}, reason: null }
```

### 🎯 Scoring Logic

#### Tier Assignment:
- **RECOMMENDED**: 
  - `availableCovers >= maxCoversPer15Min * 0.5`
  - `loadPercentage < 50%`
  
- **AVAILABLE**:
  - `availableCovers >= maxCoversPer15Min * 0.3`
  - `loadPercentage < 70%`
  
- **FLEXIBLE**:
  - `availableCovers > 0` but limited
  - `loadPercentage >= 70%`

#### Confidence Adjustment:
- **Same-day bookings** (< 120 minutes): Lower confidence
- **Very early/late slots** (< 11:00 or > 21:00): Lower confidence
- **High load**: Lower confidence

### 🔄 Integration Flow

1. **User requests availability** → `computeAvailability()`
2. **Engine generates 15-minute slots** → `generateSlots()`
3. **Engine loads reservations from ledger** → `getReservationsInWindow()`
4. **Engine builds load map** → `buildLoadMap()`
5. **Engine scores slots** → `scoreSlots()`
6. **Returns tiered, scored slots** → Ready for UI

### 📝 Service Hours Handling

The engine handles multiple service hours formats:
- **New format**: `hoursOfOperation` with `openTime`/`closeTime` and meridiem
- **Legacy format**: `hours` object with day names
- **Fallback**: Defaults to 11:00 - 22:00

### ⚙️ Configuration Options

```javascript
{
  maxCoversPer15Min: 17,      // Override capacity cap
  avgDiningDuration: 90       // Override average dining duration (minutes)
}
```

### 🧪 Testing Example

```javascript
import { computeAvailability } from './utils/availabilityEngineService';

// Get availability for tomorrow
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);

const slots = await computeAvailability({
  restaurantId: "restaurant-123",
  date: tomorrow,
  restaurantData: {
    totalSeats: 50,
    hoursOfOperation: {
      Monday: {
        openTime: "11:00",
        openMeridiem: "AM",
        closeTime: "10:00",
        closeMeridiem: "PM"
      }
    }
  }
});

// Filter for recommended slots
const recommended = slots.filter(s => s.tier === "RECOMMENDED");
console.log(`Found ${recommended.length} recommended slots`);
```

### 🚀 Next Steps

1. **UI Integration**: Update reservation UI to use availability engine
2. **Slot Selection**: Show tiered slots to users
3. **Real-time Updates**: Refresh availability when reservations change
4. **Analytics**: Track slot utilization and accuracy
5. **Machine Learning**: Improve scoring with historical data

---

**Status**: Phase 2 Availability Engine Complete ✅
**Ready for**: UI Integration or Phase 3 (Native Reservation Updates)









