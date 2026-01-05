# Phase 1 Implementation Summary
## Reservation & POS Integration Foundation

### ✅ Completed Services

#### 1. **Canonical Reservations Ledger Service** (`reservationLedgerService.js`)
- **Path**: `restaurants/{restaurantId}/reservations/{reservationId}`
- **Purpose**: System of record for all reservations (native + external)
- **Features**:
  - Append-only by clients, mutated only by backend services
  - Source-agnostic (LINEUP | OPENTABLE)
  - Status tracking with history
  - Reconciliation metadata
  - Idempotent writes with duplicate detection

**Key Functions**:
- `createReservationInLedger()` - Create reservation (with phone verification for LINEUP)
- `updateReservationStatus()` - Update status (backend only)
- `getReservationFromLedger()` - Get single reservation
- `getReservationsInWindow()` - Get reservations in time window
- `cancelReservationInLedger()` - Cancel reservation
- `markReservationReconciled()` - Mark as reconciled

#### 2. **Waiting List Service** (`waitingListService.js`)
- **Path**: `restaurants/{restaurantId}/waitingList/{entryId}`
- **Purpose**: Operational 24-hour materialization of reservations
- **Features**:
  - Mutable (hosts can reorder)
  - Ephemeral (not historical truth)
  - Priority scoring
  - Host overrides

**Key Functions**:
- `materializeWaitingList()` - Materialize from ledger (24h window)
- `getWaitingList()` - Get waiting list for hosts
- `updateWaitingListEntry()` - Host overrides
- `checkInReservation()` - Check in guest
- `seatReservation()` - Seat guest

#### 3. **POS Event Service** (`posEventService.js`)
- **Purpose**: Normalize POS events (Toast, Square, etc.) to Lineup schema
- **Features**:
  - Event normalization (Toast, Square placeholders)
  - Idempotent event storage
  - Meal lifecycle tracking
  - Table-to-reservation linking

**Event Types**:
- `SEATED` - Table seated
- `FIRST_DRINK` - First drink ordered
- `ENTREES_ORDERED` - Entrees ordered
- `CHECK_CLOSED` - Check closed (meal complete)

**Key Functions**:
- `normalizePosEvent()` - Normalize raw POS event
- `storePosEvent()` - Store event (idempotent)
- `processPosEvent()` - Process event and update meal lifecycle

#### 4. **Toast Webhook Receiver** (`services/toastWebhookReceiver.js`)
- **Purpose**: Handle Toast webhook events
- **Features**:
  - Webhook signature verification (placeholder)
  - Event normalization
  - Mock events for testing
  - Error handling

**Key Functions**:
- `handleToastWebhook()` - Main webhook handler
- `handleMockToastEvent()` - Test with mock events
- `MOCK_TOAST_EVENTS` - Pre-built mock events for testing

### 📋 Data Model Structure

#### Canonical Reservations Ledger
```javascript
{
  id: "res_...",
  restaurantId: "...",
  startAt: "2024-01-15T19:00:00Z",
  startAtTimestamp: Timestamp,
  partySize: 4,
  source: {
    system: "LINEUP" | "OPENTABLE",
    externalReservationId: "..." | null
  },
  dinerId: "...",
  dinerName: "...",
  phone: "...",
  email: "...",
  status: "BOOKED" | "CONFIRMED" | "CHECKED_IN" | "SEATED" | "CANCELLED" | "COMPLETED",
  statusHistory: [...],
  reconciliation: {
    lastReconciledAt: Timestamp,
    reconciliationStatus: "PENDING" | "RECONCILED",
    divergenceDetected: false
  },
  metadata: {...},
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### Waiting List Entry
```javascript
{
  id: "wl_...",
  reservationId: "res_...",
  startAt: "2024-01-15T19:00:00Z",
  partySize: 4,
  dinerName: "...",
  phone: "...",
  status: "CONFIRMED" | "CHECKED_IN" | "SEATED",
  isCheckedIn: false,
  priorityScore: 15.5, // Lower = higher priority
  externallySeated: false,
  hostOverride: null,
  hostNotes: null,
  materializedAt: Timestamp,
  updatedAt: Timestamp
}
```

#### POS Event
```javascript
{
  id: "...",
  posSystem: "TOAST" | "SQUARE" | "CLOVER",
  posEventId: "...",
  eventType: "SEATED" | "FIRST_DRINK" | "ENTREES_ORDERED" | "CHECK_CLOSED",
  restaurantId: "...",
  tableId: "...",
  timestamp: "2024-01-15T19:00:00Z",
  metadata: {...},
  rawEvent: {...}, // Original POS event
  processed: false,
  storedAt: Timestamp
}
```

### 🔄 Integration Flow

1. **Native Reservation**:
   - Guest books → `createReservationInLedger()` → Ledger
   - Periodic materialization → `materializeWaitingList()` → waitingList

2. **External Reservation (OpenTable)**:
   - Webhook/Polling → Normalize → `createReservationInLedger()` → Ledger
   - Materialization → waitingList

3. **POS Event (Toast)**:
   - Webhook → `handleToastWebhook()` → Normalize → Store → Process
   - Updates reservation status and meal lifecycle

### 🧪 Testing

Use mock Toast events for testing:
```javascript
import { handleMockToastEvent, MOCK_TOAST_EVENTS } from '../services/toastWebhookReceiver';

// Test seating event
await handleMockToastEvent(MOCK_TOAST_EVENTS.TABLE_SEATED);

// Test order event
await handleMockToastEvent(MOCK_TOAST_EVENTS.ENTREES_ORDERED);

// Test check closed
await handleMockToastEvent(MOCK_TOAST_EVENTS.CHECK_CLOSED);
```

### 📝 Next Steps (Phase 2)

1. **Availability Engine MVP**
   - Slot generation (15-minute intervals)
   - Load mapping from ledger
   - Capacity caps
   - Slot scoring

2. **Native Reservation UI Updates**
   - Migrate to use `reservationLedgerService`
   - Phone verification
   - 15-minute slot enforcement
   - 2-hour modification/cancellation cutoff

3. **Host UX**
   - Waiting list view
   - Check-in interface
   - Seating interface
   - Override tracking

4. **OpenTable Integration**
   - Webhook receiver
   - Polling fallback
   - Reconciliation worker

### 🔒 Security Notes

- **Diners**: Read-only access to their own reservations
- **Hosts**: Read/write access to waitingList only
- **Backend Services**: Admin SDK access to ledger (scoped IAM)
- **Firestore Rules**: Need to be updated (separate task)

### ⚠️ Important Notes

1. **Existing Reservation Service**: The old `reservationService.js` still exists. We'll need to migrate the UI to use the new ledger service.

2. **Table Assignment**: Currently simplified - need to implement proper table assignment tracking for POS event linking.

3. **Materialization**: `materializeWaitingList()` should be called periodically (Cloud Function or scheduled job).

4. **Toast Credentials**: Webhook signature verification is placeholder until we have Toast API credentials.

---

**Status**: Phase 1 Foundation Complete ✅
**Ready for**: Phase 2 (Availability Engine) or UI Integration









