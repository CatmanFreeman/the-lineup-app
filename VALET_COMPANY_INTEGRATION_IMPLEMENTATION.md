# Valet Company Integration Implementation

## Overview

The valet company integration system allows external valet companies to partner with restaurants through the Lineup app. Valet drivers are users (not employees) with a "VALET" role, assigned to valet companies and restaurant locations. The system manages the entire valet workflow while allowing valet companies to focus on driving cars.

## Key Features

### ✅ Implemented

1. **Valet Company Organization Structure**
   - Valet companies are separate organizations (not restaurants)
   - Stored in `valetCompanies/{companyId}` collection
   - Tracks company info, contact details, and driver lists

2. **Valet Driver User System**
   - Valet drivers are **users** (not employees) with role "VALET"
   - Stored in `users/{userId}` with:
     - `role: "VALET"`
     - `valetCompanyId`: Company they work for
     - `restaurantId`: Assigned restaurant location
     - `organization`: Valet company ID
     - `assignedLocation`: Restaurant ID

3. **Restaurant Authorization System**
   - Restaurants can approve/reject valet company authorization requests
   - Authorization stored in `restaurants/{restaurantId}/valetAuthorizations/{authId}`
   - Status: PENDING → APPROVED/REJECTED
   - Notifications sent to restaurant managers for pending requests

4. **Valet Driver Dashboard**
   - Dedicated dashboard at `/dashboard/valet/{restaurantId}`
   - Shows active tickets requiring action
   - Real-time notifications for car retrieval
   - Actions: Start Retrieval, Car Ready

5. **Integrated Valet Workflow**
   - Updated `valetService.js` to use valet company system
   - Notifications sent to valet drivers (users) instead of staff
   - Falls back to legacy staff system if no valet company drivers found

6. **Restaurant Management UI**
   - New "Valet Companies" tab in Restaurant Dashboard
   - View pending authorization requests
   - Approve/reject valet companies
   - View authorized companies and their activity

## Architecture

### Firestore Structure

```
valetCompanies/{companyId}
  - name: string
  - contactName: string
  - contactEmail: string
  - contactPhone: string
  - address: string
  - status: "ACTIVE" | "SUSPENDED"
  - drivers: [userId1, userId2, ...]
  - createdAt: timestamp
  - updatedAt: timestamp

users/{userId}
  - role: "VALET"
  - valetCompanyId: string
  - restaurantId: string
  - organization: string (valetCompanyId)
  - assignedLocation: string (restaurantId)
  - name: string
  - email: string
  - phone: string
  - status: "ACTIVE" | "INACTIVE" | "SUSPENDED"

restaurants/{restaurantId}/valetAuthorizations/{authId}
  - valetCompanyId: string
  - restaurantId: string
  - status: "PENDING" | "APPROVED" | "REJECTED"
  - requestedBy: userId
  - requestedAt: timestamp
  - approvedBy: userId (if approved/rejected)
  - approvedAt: timestamp
```

### Core Services

1. **`valetCompanyService.js`**
   - `createOrUpdateValetCompany()` - Create/update valet company
   - `registerValetDriver()` - Register driver as user with VALET role
   - `requestRestaurantAuthorization()` - Request restaurant approval
   - `approveOrRejectAuthorization()` - Approve/reject request
   - `getAuthorizedValetCompanies()` - Get approved companies for restaurant
   - `getValetDriversForRestaurant()` - Get all valet drivers for restaurant
   - `getValetActivity()` - Get valet activity/timing metrics

2. **Updated `valetService.js`**
   - `notifyValetDrivers()` - Now uses valet company service
   - Gets drivers from `users` collection (role="VALET")
   - Falls back to legacy `staff` collection if needed

## User Flow

### Valet Company Registration

1. Valet company creates account (or admin creates for them)
2. Company info stored in `valetCompanies` collection
3. Company requests authorization from restaurant
4. Restaurant manager receives notification
5. Manager approves/rejects in Restaurant Dashboard

### Valet Driver Registration

1. Driver creates user account (or company registers them)
2. Driver assigned to valet company and restaurant location
3. User profile updated with:
   - `role: "VALET"`
   - `valetCompanyId`
   - `restaurantId`
   - `organization`
4. Driver can now access Valet Driver Dashboard

### Valet Workflow

1. **Guest Arrives & Checks In**
   - Guest selects valet parking
   - Guest uploads valet ticket photo (or hostess does it)
   - Ticket status: `PENDING_UPLOAD` → `UPLOADED`

2. **Check Dropped**
   - POS event triggers `handleCheckDropped()`
   - System finds valet ticket for reservation
   - Status: `UPLOADED` → `CHECK_DROPPED`
   - **All valet drivers** at restaurant get notification: "Retrieve Car"

3. **Driver Retrieves Car**
   - Driver opens Valet Driver Dashboard
   - Sees ticket in "Active Tickets"
   - Clicks "Start Retrieval"
   - Status: `CHECK_DROPPED` → `RETRIEVING`

4. **Car Ready**
   - Driver gets car and clicks "Car Ready"
   - Status: `RETRIEVING` → `READY`
   - **Diner gets notification**: "Your car is ready!" (with tip share option)

5. **Diner Leaves**
   - Diner picks up car
   - Ticket status: `READY` → `COMPLETED`

## Dashboards

### Valet Driver Dashboard (`/dashboard/valet/{restaurantId}`)

**Features:**
- Active Tickets tab - Shows tickets requiring action
- Notifications tab - Real-time notifications
- Actions:
  - "Start Retrieval" (when check dropped)
  - "Car Ready" (when car retrieved)

**Access:**
- Only users with `role: "VALET"` and `restaurantId` matching
- Redirects to login if not authenticated
- Shows error if not a valet driver

### Restaurant Dashboard - Valet Companies Tab

**Features:**
- View pending authorization requests
- Approve/reject valet companies
- View authorized companies
- Request new authorization

**Access:**
- Restaurant managers only
- Located in Restaurant Dashboard tabs

## Notifications

### New Notification Types

- `VALET_AUTHORIZATION_REQUEST` - Restaurant manager notified of new request
- `VALET_COMPANY_APPROVED` - Valet drivers notified when company approved
- `VALET_RETRIEVE_CAR` - Driver notified to retrieve car (existing)
- `VALET_CAR_READY` - Diner notified car is ready (existing)

## Benefits

1. **Partnership Model**
   - Valet companies are partners, not competitors
   - App manages workflow, companies focus on driving
   - No money handling by app (valet companies handle payments)

2. **Scalability**
   - Multiple valet companies can serve same restaurant
   - Drivers can be assigned to multiple locations
   - Easy to add/remove drivers

3. **Transparency**
   - Restaurant sees all valet activity
   - Valet company sees their drivers' activity
   - Real-time status updates

4. **Efficiency**
   - Automated notifications
   - No manual coordination needed
   - Drivers know exactly when to retrieve cars

## Future Enhancements

1. **Valet Company Dashboard**
   - Manage drivers
   - View activity metrics
   - Track performance

2. **Activity Tracking & Metrics**
   - Average retrieval time
   - Driver performance
   - Ticket completion rates
   - Already integrated in `getValetActivity()`

3. **Multi-Location Support**
   - Drivers assigned to multiple restaurants
   - Company-wide activity view

4. **Driver Scheduling**
   - Schedule drivers for shifts
   - Track who's on duty

## Testing

To test the valet company system:

1. **Create Valet Company:**
   ```javascript
   await createOrUpdateValetCompany({
     name: "ABC Valet Services",
     contactName: "John Doe",
     contactEmail: "john@abcvalet.com",
     contactPhone: "555-1234",
     address: "123 Main St"
   });
   ```

2. **Register Driver:**
   ```javascript
   await registerValetDriver({
     userId: "driver-user-id",
     valetCompanyId: "company-id",
     restaurantId: "restaurant-id",
     name: "Driver Name",
     email: "driver@email.com",
     phone: "555-5678"
   });
   ```

3. **Request Authorization:**
   - Go to Restaurant Dashboard → Valet Companies tab
   - Click "Request Authorization"
   - Enter valet company ID

4. **Approve Authorization:**
   - Restaurant manager sees pending request
   - Clicks "Approve"
   - Valet drivers get notified

5. **Test Workflow:**
   - Guest checks in with valet
   - Check drops → Driver gets notification
   - Driver retrieves car → Diner gets "car ready" notification

## Notes

- Valet drivers are **users**, not employees
- They have a user dashboard, not employee dashboard
- Role is "VALET" (uppercase)
- Organization is the valet company ID
- Assigned location is the restaurant ID
- System works alongside existing valet workflow
- Falls back to legacy staff system if no valet company drivers








