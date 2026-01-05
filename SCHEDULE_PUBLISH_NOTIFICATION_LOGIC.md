# Schedule Publish Notification Logic - Implementation Summary

## ✅ **CURRENT STATE**

### **What's Already Working:**
1. ✅ **Reservations can be made without schedule:**
   - When schedule isn't published, `getAvailableServers()` returns empty array
   - Reservation page shows: "No schedule available for this date yet. Server selection will be made at the restaurant. Guest will be notified once schedule becomes available."
   - Reservation can still be created without server selection

2. ✅ **Server selection only appears when schedule is published:**
   - `getAvailableServers()` checks `scheduleData.status !== "published"`
   - If not published, returns empty array (no servers shown)
   - If published, returns available servers for that date

### **What Was Missing:**
1. ❌ **No notification when schedule is published**
2. ❌ **No way to update existing reservations to add server**

---

## ✅ **NEW IMPLEMENTATION**

### **1. Schedule Notification Service** (`src/utils/scheduleNotificationService.js`)

**Function:** `notifyGuestsOnSchedulePublish(restaurantId, weekEndingISO, dateISOs)`

**What it does:**
- Finds all reservations for published dates from canonical ledger
- Filters for:
  - LINEUP reservations (not OpenTable)
  - Active status (not cancelled/completed/no-show)
  - No server selected (`metadata.serverId` is null)
  - Has `dinerId` (so we can notify them)
  - Reservation date matches published dates
- Creates notifications for each guest
- Notification includes link to reservation page with `selectServer=true` param

**Integration:**
- Called automatically when schedule is published in `SchedulingTab.jsx`
- Uses `publishWeekToFirestore` callback

### **2. Update Reservation to Add Server**

**New Function:** `updateReservationMetadata()` in `reservationLedgerService.js`

**What it does:**
- Updates reservation metadata to add `serverId` and `serverName`
- Preserves existing metadata
- Updates `updatedAt` timestamp
- Can be called from reservation page when guest selects server

**Usage:**
- Guest receives notification
- Clicks notification → Goes to reservation page with `selectServer=true`
- Reservation page loads existing reservation
- Shows server selection UI
- Guest selects server → Calls `updateReservationMetadata()`

### **3. Reservation Page Updates**

**New Features:**
- Check URL params for `reservationId` and `selectServer=true`
- If present, load existing reservation
- Pre-fill form with reservation data
- Show server selection UI (if schedule is published)
- Allow updating reservation to add server
- Show success message when server is added

---

## 🔄 **FLOW**

### **Scenario 1: Guest Reserves Before Schedule Published**

1. Guest makes reservation → No server selection available
2. Reservation created in ledger with `metadata.serverId = null`
3. Manager publishes schedule
4. `notifyGuestsOnSchedulePublish()` runs automatically
5. Guest receives notification: "Schedule Published - Select Your Server!"
6. Guest clicks notification → Goes to `/reservations?reservationId=123&selectServer=true`
7. Reservation page loads existing reservation
8. Server selection UI appears (schedule now published)
9. Guest selects server
10. Reservation updated with `metadata.serverId` and `metadata.serverName`
11. Server receives notification (if they have notifications enabled)

### **Scenario 2: Guest Reserves After Schedule Published**

1. Guest makes reservation → Server selection available
2. Guest can select server immediately
3. Reservation created with `metadata.serverId` set
4. Server receives notification immediately

---

## 📋 **IMPLEMENTATION CHECKLIST**

- [x] Create `scheduleNotificationService.js`
- [x] Add `notifyGuestsOnSchedulePublish()` function
- [x] Integrate into `SchedulingTab.jsx` publish function
- [ ] Add `updateReservationMetadata()` to `reservationLedgerService.js`
- [ ] Update `Reservation.jsx` to handle `reservationId` and `selectServer` params
- [ ] Add UI to show existing reservation when updating
- [ ] Add "Update Server" button/functionality
- [ ] Test notification flow
- [ ] Test reservation update flow

---

## 🎯 **KEY POINTS**

1. **Reservations work without schedule:** ✅ Already implemented
2. **Server selection only when published:** ✅ Already implemented
3. **Guests notified when published:** ✅ Now implemented
4. **Guests can update reservations:** ⏳ Needs implementation

---

**Status:** Notification logic complete, reservation update logic needs to be added.









