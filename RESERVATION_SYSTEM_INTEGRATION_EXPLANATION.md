# Reservation System Integration Explanation
## How the New System Integrates with Dashboards & Overall Flow

### 🎯 **Current State vs. New System**

#### **BEFORE (Old System)**
- Reservations stored in flat `reservations` collection
- No source tracking (LINEUP vs. OpenTable)
- No availability engine
- No waiting list
- Static reservation display

#### **AFTER (New System)**
- Reservations in canonical ledger: `restaurants/{restaurantId}/reservations/{reservationId}`
- Source-agnostic (LINEUP | OPENTABLE)
- Availability engine computes slots from load
- Waiting list materialized from ledger
- Real-time updates from POS events

---

## 📊 **Dashboard Integration Points**

### **1. RESTAURANT DASHBOARD**

#### **Current Tabs:**
- Overview
- Staff
- Inventory
- Scheduling
- Finance
- Live Lineup
- Messaging

#### **Integration Points:**

##### **A. Overview Tab** (`OverviewTab.jsx`)
**Current State:**
- Shows reservation counts (shift/today/week)
- Displays `ReservationsTimelineChart`
- Shows `UpcomingReservationsList`

**New Integration Needed:**
```javascript
// OLD: Reads from flat reservations collection
const reservations = await getDocs(collection(db, "reservations"));

// NEW: Should read from canonical ledger
import { getReservationsInWindow } from "../../../utils/reservationLedgerService";

const reservations = await getReservationsInWindow({
  restaurantId: currentRestaurant.id,
  startDate: startOfDay,
  endDate: endOfDay,
});
```

**Impact:**
- ✅ Shows both LINEUP and OpenTable reservations
- ✅ Real-time status updates (BOOKED → CONFIRMED → SEATED → COMPLETED)
- ✅ Source badges (shows "OT" for OpenTable reservations)
- ✅ More accurate counts (filters cancelled/completed properly)

##### **B. NEW: Reservations Tab** (To Be Added)
**Purpose:** Host/Manager view of reservations

**Features:**
- **Waiting List View**: Shows 24-hour materialized waiting list
- **Check-In Interface**: Mark guests as checked in
- **Seating Interface**: Mark guests as seated
- **Reservation Details**: View full reservation info
- **Source Filtering**: Filter by LINEUP vs. OpenTable
- **Status Filtering**: Filter by status (CONFIRMED, CHECKED_IN, SEATED)

**Implementation:**
```javascript
import { getWaitingList } from "../../../utils/waitingListService";
import { checkInReservation, seatReservation } from "../../../utils/waitingListService";

// In Restaurant Dashboard tabs array:
{ key: "reservations", label: "Reservations" }

// In renderTabContent:
case "reservations":
  return <ReservationsTab restaurantId={restaurantId} />;
```

**Flow:**
1. Host opens Reservations tab
2. System loads waiting list (24-hour window)
3. Host sees prioritized list of guests
4. Host can check in guests → Updates ledger status to CHECKED_IN
5. Host can seat guests → Updates ledger status to SEATED
6. POS events can also update status (Toast integration)

---

### **2. COMPANY DASHBOARD**

#### **Current Tabs:**
- Overview
- Restaurants
- Staff
- Settings

#### **Integration Points:**

##### **A. Overview Tab**
**New Metrics:**
- Total reservations across all restaurants
- LINEUP vs. OpenTable breakdown
- Reservation trends
- Reconciliation status (for OpenTable)

**Implementation:**
```javascript
// Aggregate reservations across all restaurants
const allReservations = await Promise.all(
  restaurants.map(r => 
    getReservationsInWindow({
      restaurantId: r.id,
      startDate: startOfWeek,
      endDate: endOfWeek,
    })
  )
);

// Calculate metrics
const lineupCount = allReservations.flat().filter(r => r.source?.system === "LINEUP").length;
const opentableCount = allReservations.flat().filter(r => r.source?.system === "OPENTABLE").length;
```

##### **B. Settings Tab → Integrations Section**
**New Feature:** OpenTable Integration Configuration

**Purpose:** Configure OpenTable API credentials per restaurant

**UI:**
- Enable/disable OpenTable integration
- Enter API key
- Enter restaurant ID
- Enter webhook secret
- Test connection
- View last reconciliation report

**Implementation:**
```javascript
import { getOpenTableConfig, updateOpenTableConfig } from "../../../utils/opentableService";

// In Settings Tab:
<OpenTableIntegrationConfig 
  restaurantId={selectedRestaurant.id}
  config={openTableConfig}
  onUpdate={handleUpdateConfig}
/>
```

---

### **3. EMPLOYEE DASHBOARD**

#### **Current Tabs:**
- Overview
- Schedule
- TipShare
- Resume
- Onboarding
- Documents
- Badges
- Performance
- Messaging

#### **Integration Points:**

##### **A. Overview Tab**
**New Feature:** My Reservations (for Server/Diner accounts)

**Purpose:** Show reservations where employee is the requested server

**Implementation:**
```javascript
// Filter reservations by serverId in metadata
const myReservations = await getReservationsInWindow({
  restaurantId: restaurantId,
  startDate: today,
  endDate: endOfWeek,
});

const requestedReservations = myReservations.filter(
  r => r.metadata?.serverId === employeeUid
);
```

**Display:**
- Upcoming reservations where employee is requested
- Guest name, party size, time
- Special requests/preferences
- Status (CONFIRMED, CHECKED_IN, SEATED)

##### **B. Performance Tab**
**New Metrics:** Reservation-related performance

- Reservations served (count)
- Guest satisfaction (from reviews)
- Average party size
- Repeat guest rate

---

## 🔄 **Overall Flow Changes**

### **1. Reservation Creation Flow**

#### **OLD FLOW:**
```
Diner → Reservation Page → createReservation() 
  → Flat reservations collection
  → Notification sent
```

#### **NEW FLOW:**
```
Diner → Reservation Page → Availability Engine (computes slots)
  → Diner selects tiered slot
  → Phone verification
  → createReservationInLedger() 
  → Canonical Ledger (restaurants/{id}/reservations/{id})
  → Materialization Worker → waitingList (24h window)
  → Notification sent
```

**Key Differences:**
- ✅ Availability computed from existing load
- ✅ 15-minute slot enforcement
- ✅ Phone verification required
- ✅ Source tracking (LINEUP)
- ✅ Status starts as BOOKED (requires confirmation)

---

### **2. OpenTable Integration Flow**

#### **Webhook Flow:**
```
OpenTable → Webhook → handleOpenTableWebhook()
  → normalizeOpenTableReservation()
  → createReservationFromOpenTable()
  → Canonical Ledger (source: OPENTABLE)
  → Materialization Worker → waitingList
  → Restaurant Dashboard updated
```

#### **Polling Flow (Fallback):**
```
Scheduled Job (every 15-30 min) → pollOpenTableReservations()
  → OpenTable API
  → normalizeOpenTableReservation()
  → createReservationFromOpenTable()
  → Canonical Ledger
```

#### **Reconciliation Flow:**
```
Scheduled Job (hourly) → reconcileOpenTableReservations()
  → Fetch from OpenTable API
  → Compare with Ledger
  → Identify divergences
  → Create/Update/Cancel as needed
  → Store reconciliation report
  → Company Dashboard shows reconciliation status
```

---

### **3. Host/Staff Workflow**

#### **OLD FLOW:**
```
Host opens reservations list
  → Static list from reservations collection
  → Manual check-in (if feature exists)
```

#### **NEW FLOW:**
```
Host opens Reservations Tab
  → getWaitingList() loads 24h materialized list
  → Prioritized by priorityScore
  → Host checks in guest
    → checkInReservation() 
    → Updates ledger status to CHECKED_IN
    → Updates waitingList entry
  → Host seats guest
    → seatReservation()
    → Updates ledger status to SEATED
    → Updates waitingList entry
  → POS events can also update status (Toast)
```

**Key Benefits:**
- ✅ Real-time updates
- ✅ Prioritized list (checked-in guests first)
- ✅ Source-agnostic (LINEUP and OpenTable together)
- ✅ Status history tracking

---

### **4. POS Integration Flow (Toast)**

#### **Event Flow:**
```
Toast POS → Webhook → handleToastWebhook()
  → normalizePosEvent()
  → storePosEvent()
  → processPosEvent()
  → Links to reservation by table
  → Updates reservation status:
    - SEATED event → Status: SEATED
    - CHECK_CLOSED event → Status: COMPLETED
  → Updates waitingList
  → Restaurant Dashboard reflects changes
```

**Impact:**
- ✅ Automatic status updates (no manual host action needed)
- ✅ Accurate meal lifecycle tracking
- ✅ Real-time availability updates

---

## 📈 **Data Flow Architecture**

```
┌─────────────────────────────────────────────────────────┐
│                    DINER EXPERIENCE                      │
│  Reservation Page → Availability Engine → Ledger       │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              CANONICAL RESERVATIONS LEDGER                │
│  restaurants/{restaurantId}/reservations/{reservationId} │
│  - Source: LINEUP | OPENTABLE                            │
│  - Status: BOOKED → CONFIRMED → CHECKED_IN → SEATED →   │
│    COMPLETED                                             │
└───────────────┬───────────────────────┬─────────────────┘
                │                       │
                ▼                       ▼
    ┌───────────────────┐   ┌──────────────────────┐
    │   WAITING LIST    │   │   POS EVENTS (Toast)  │
    │  (24h materialized)│   │  - SEATED            │
    │  - Mutable         │   │  - CHECK_CLOSED      │
    │  - Prioritized      │   │  - Updates status    │
    └──────────┬─────────┘   └──────────────────────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │      RESTAURANT DASHBOARD             │
    │  - Overview: Reservation counts        │
    │  - Reservations Tab: Waiting list      │
    │  - Real-time status updates            │
    └──────────────────────────────────────┘
```

---

## 🔧 **What Needs to Be Updated**

### **1. Restaurant Dashboard Overview Tab**
**File:** `src/pages/Dashboards/RestaurantDashboard/tabs/OverviewTab.jsx`

**Changes:**
- Replace `collection(db, "reservations")` queries with `getReservationsInWindow()`
- Filter by `restaurantId` (already scoped)
- Show source badges (LINEUP vs. OpenTable)
- Display status from ledger

**Code:**
```javascript
// OLD
const reservationsRef = collection(db, "reservations");
const q = query(reservationsRef, where("restaurantId", "==", restaurantId));

// NEW
import { getReservationsInWindow } from "../../../../utils/reservationLedgerService";
const reservations = await getReservationsInWindow({
  restaurantId: restaurantId,
  startDate: startOfDay.toISOString(),
  endDate: endOfDay.toISOString(),
});
```

### **2. Add Reservations Tab to Restaurant Dashboard**
**New File:** `src/pages/Dashboards/RestaurantDashboard/tabs/ReservationsTab.jsx`

**Features:**
- Waiting list display
- Check-in interface
- Seating interface
- Filter by source/status
- Search functionality

### **3. Company Dashboard Settings**
**File:** `src/pages/Dashboards/CompanyDashboard/CompanyDashboard.jsx`

**Add:**
- OpenTable integration configuration UI
- Reconciliation report viewer
- Integration status per restaurant

### **4. Employee Dashboard Overview**
**File:** `src/pages/Dashboards/EmployeeDashboard/EmployeeDashboard.jsx`

**Add:**
- "My Reservations" section
- Shows reservations where employee is requested server
- Status updates

---

## 🎯 **Key Benefits of New System**

### **For Restaurants:**
1. **Unified View**: All reservations (LINEUP + OpenTable) in one place
2. **Real-Time Updates**: POS events automatically update status
3. **Prioritized Waiting List**: Hosts see guests in priority order
4. **Accurate Availability**: Computed from actual load, not static slots
5. **Reconciliation**: Automatic sync with OpenTable

### **For Diners:**
1. **Better Availability**: See tiered slots (RECOMMENDED, AVAILABLE, FLEXIBLE)
2. **Phone Verification**: More secure reservations
3. **15-Minute Slots**: Clearer time selection
4. **Source Transparency**: See if reservation is from LINEUP or OpenTable

### **For Employees:**
1. **My Reservations**: See where they're requested
2. **Real-Time Status**: Know when guests check in/seat
3. **Performance Metrics**: Reservation-related stats

### **For Company:**
1. **Cross-Restaurant Analytics**: Aggregate reservation data
2. **Integration Management**: Configure OpenTable per restaurant
3. **Reconciliation Monitoring**: Track sync status

---

## ⚠️ **Migration Notes**

### **Backward Compatibility:**
- Old `reservations` collection still exists
- New system writes to canonical ledger
- Can run both in parallel during migration
- Old UI can be updated gradually

### **Data Migration:**
- Need to migrate existing reservations to ledger
- Map old `reservations` → `restaurants/{id}/reservations/{id}`
- Set `source.system = "LINEUP"` for migrated reservations
- Preserve all metadata

---

## 🚀 **Next Steps for Full Integration**

1. **Update Overview Tab** to use ledger service
2. **Create Reservations Tab** for Restaurant Dashboard
3. **Add OpenTable Config UI** to Company Dashboard Settings
4. **Add My Reservations** to Employee Dashboard
5. **Set up Scheduled Jobs** for:
   - Waiting list materialization (every 5-10 min)
   - OpenTable polling (every 15-30 min)
   - Reconciliation (hourly)
6. **Deploy Webhook Endpoints** for:
   - OpenTable webhooks
   - Toast webhooks

---

**Status**: Foundation Complete ✅
**Integration**: Dashboard updates needed for full integration
**Impact**: Significant improvement in reservation management and visibility









