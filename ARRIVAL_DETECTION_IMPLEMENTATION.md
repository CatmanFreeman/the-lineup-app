# Arrival Detection System Implementation

## Overview

The arrival detection system automatically detects when logged-in users arrive at restaurants and prompts them to check in (if they have a reservation) or join the waiting list (if they're a walk-up). The system is designed to be battery-efficient and works from the user's car before they enter the restaurant.

## Features

### ✅ Implemented

1. **Smart Geofencing**
   - **Detection Radius**: 200 feet (~61 meters) - detects when user is driving by
   - **Notification Radius**: 50 feet (~15 meters) - only triggers notification when user is actually at the restaurant
   - Prevents annoying notifications when just driving by

2. **Battery-Optimized Location Monitoring**
   - **Normal Mode**: Checks location every 15 minutes
   - **Nearby Mode**: When within 200 feet of a restaurant, checks every 30 seconds
   - Automatically switches between modes based on proximity

3. **Reservation Detection**
   - Automatically checks if user has an active reservation for today
   - Shows check-in prompt with reservation time
   - Includes valet parking option

4. **Walk-Up Detection**
   - If no reservation, prompts to join waiting list
   - Shows multiple restaurants if user is near several
   - Displays restaurant logo, name, and live rating

5. **Multiple Restaurant Support**
   - If near multiple restaurants, shows selection cards
   - Each card displays:
     - Restaurant logo
     - Restaurant name
     - Live rating
     - Link to view live lineup

## Architecture

### Core Services

1. **`arrivalDetectionService.js`**
   - `getAllRestaurants()` - Loads all restaurants with coordinates
   - `findNearbyRestaurants()` - Finds restaurants within detection radius
   - `checkActiveReservation()` - Checks if user has reservation
   - `triggerArrivalNotification()` - Creates notifications for arrival
   - `getCurrentLocation()` - Gets user's current GPS location

2. **`useArrivalDetection` Hook**
   - Monitors user location continuously
   - Manages check intervals (15 min normal, 30 sec nearby)
   - Triggers notifications when within 50 feet
   - Tracks notification cooldowns (5 minutes per restaurant)

3. **`ArrivalDetectionProvider` Component**
   - Wraps the entire app
   - Monitors arrival notifications
   - Shows restaurant selection modal when needed
   - Handles notification clicks

### UI Components

1. **`RestaurantSelectionModal`**
   - Shows multiple nearby restaurants as cards
   - User can select one to join waiting list
   - Each card shows logo, name, rating, and lineup link

2. **`ArrivalCheckInPage`**
   - Shown when user has a reservation
   - Uses existing `GuestCheckIn` component
   - Handles check-in and valet selection

3. **`ArrivalWaitingListPage`**
   - Shown when user wants to join waiting list
   - Allows party size selection
   - Creates walk-up reservation entry

## Flow

### With Reservation

1. User arrives within 200 feet → System detects
2. User enters 50 feet → Notification triggered
3. System checks for active reservation → Found
4. Notification: "Ready to check in? You're here! Check in for your 7:30 PM reservation at Bravo Kitchen."
5. User clicks notification → Goes to check-in page
6. User checks in → Can select valet parking
7. Valet ticket upload (if selected)

### Without Reservation (Walk-Up)

1. User arrives within 200 feet → System detects
2. User enters 50 feet → Notification triggered
3. System checks for active reservation → None found
4. **Single Restaurant**: Notification: "Join the waiting list? You're at Bravo Kitchen."
5. **Multiple Restaurants**: Notification: "You're near 3 restaurants. Would you like to join a waiting list?"
6. User clicks notification → Goes to waiting list page or restaurant selection
7. User selects restaurant → Joins waiting list
8. Creates walk-up reservation entry in ledger

## Technical Details

### Location Checking

- **Normal Interval**: 15 minutes (battery-friendly)
- **Nearby Interval**: 30 seconds (when within 200 feet)
- **Cooldown**: 5 minutes between notifications for same restaurant
- **Accuracy**: Uses high-accuracy GPS when available

### Battery Optimization

- Checks location only when app is open (foreground)
- Uses reasonable intervals (15 min default)
- Stops frequent checking when not near restaurants
- Background mode requires push notifications (future enhancement)

### Notification System

- Creates in-app notifications via `notificationService`
- Priority: HIGH (for push notifications when FCM is set up)
- Includes action URLs for direct navigation
- Metadata includes restaurant info and reservation details

## Routes

- `/arrival/checkin?restaurantId=X&reservationId=Y` - Check-in page
- `/arrival/waitinglist?restaurantId=X` - Waiting list page
- `/arrival/select?restaurants=X,Y,Z` - Restaurant selection (handled by modal)

## Integration Points

1. **Reservation Ledger**: Checks for active reservations
2. **Waiting List Service**: Adds walk-ups to waiting list
3. **Valet Service**: Handles valet ticket uploads
4. **Notification Service**: Creates arrival notifications
5. **Firestore**: Stores restaurant locations and reservations

## Future Enhancements

1. **Background Push Notifications**
   - Requires Firebase Cloud Messaging (FCM) setup
   - Will enable arrival detection when app is in background
   - Currently only works when app is open

2. **Wait Time Estimation**
   - Show estimated wait time when joining waiting list
   - Based on current queue length and historical data

3. **Smart Notifications**
   - Learn user patterns (favorite restaurants, typical arrival times)
   - Adjust notification timing based on user behavior

4. **Geofence Optimization**
   - Adjust detection radius based on restaurant type (mall vs standalone)
   - Handle edge cases (parking garages, multi-level buildings)

## Testing

To test the arrival detection system:

1. **Enable Location Permissions**: Grant location access when prompted
2. **Simulate Arrival**: 
   - Use browser dev tools to simulate GPS coordinates
   - Or physically visit a restaurant with coordinates in Firestore
3. **Check Notifications**: 
   - Should see notification when within 50 feet
   - Should see check-in prompt if you have a reservation
   - Should see waiting list prompt if no reservation

## Notes

- **Location Permissions**: Required for the system to work
- **HTTPS Required**: Browser geolocation requires HTTPS (or localhost)
- **Restaurant Coordinates**: Restaurants must have `lat` and `lng` fields in Firestore
- **Notification Cooldown**: Prevents spam notifications (5 min per restaurant)








