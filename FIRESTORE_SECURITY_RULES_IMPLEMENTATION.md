# Firestore Security Rules Implementation
## Complete Security Rules for Reservation System

### ✅ **IMPLEMENTED SECURITY RULES**

---

## 🔒 **RESERVATIONS LEDGER**
**Path:** `restaurants/{restaurantId}/reservations/{reservationId}`

### **Read Access:**
- ✅ Diners can read their own reservations (`dinerId == userId`)
- ✅ Restaurant staff can read all reservations for their restaurant

### **Create Access:**
- ✅ Diners can create reservations (must be the diner)
- ✅ Validates: `sourceSystem` must be "LINEUP" or "OPENTABLE"
- ✅ Validates: `partySize` must be between 1-50

### **Update Access:**
- ✅ Diners can update metadata (server selection) on their own reservations
  - Cannot change: `startAt`, `partySize`, `status`, `dinerId`, `sourceSystem`
  - Can change: `metadata` (serverId, serverName, preferences, etc.)
- ✅ Restaurant staff can update status and metadata
  - Cannot change: `startAt`, `partySize`, `dinerId`, `sourceSystem`
  - Can change: `status`, `metadata`

### **Delete Access:**
- ❌ No client-side delete (use `cancelReservationInLedger` service function)

---

## 📋 **WAITING LIST**
**Path:** `restaurants/{restaurantId}/waitingList/{entryId}`

### **Access:**
- ✅ Restaurant staff can read/write
- ✅ Backend services can write (materialization)
- ❌ Diners cannot access waiting list

---

## 📅 **SCHEDULES**
**Path:** `restaurants/{restaurantId}/schedules/{weekEndingISO}`

### **Read Access:**
- ✅ Restaurant staff can read all schedules
- ✅ Employees can read published schedules only
- ❌ Employees cannot read draft schedules

### **Write Access:**
- ✅ Restaurant staff can write schedules
- ❌ Employees cannot write schedules

---

## 👥 **STAFF COLLECTION**
**Path:** `restaurants/{restaurantId}/staff/{staffId}`

### **Access:**
- ✅ Staff can read their own data
- ✅ Restaurant staff can read all staff data
- ✅ Restaurant managers can write staff data
- ❌ Staff cannot write their own data (prevents self-modification)

---

## 💳 **POS EVENTS**
**Path:** `restaurants/{restaurantId}/posEvents/{eventId}`

### **Access:**
- ✅ Restaurant staff can read POS events
- ❌ No client-side writes (only backend services via Admin SDK)

---

## 🔔 **NOTIFICATIONS**
**Path:** `notifications/{notificationId}`

### **Access:**
- ✅ Users can read their own notifications
- ✅ Users can update read status
- ❌ Users cannot create notifications (backend only)

---

## 💰 **TIPSHARE**
**Paths:**
- `users/{userId}/tipshare/transactions/{transactionId}`
- `users/{userId}/tipshare/balance`

### **Access:**
- ✅ Users can read their own transactions and balance
- ❌ No client-side writes (only backend services via Admin SDK)

---

## 💬 **MESSAGING**
**Paths:**
- `conversations/{conversationId}`
- `conversations/{conversationId}/messages/{messageId}`

### **Access:**
- ✅ Users can read conversations they're part of
- ✅ Users can create conversations (as sender)
- ✅ Users can update their own conversations (mark as read)
- ✅ Users can create messages in conversations they're part of

---

## 🏢 **COMPANIES**
**Path:** `companies/{companyId}/restaurants/{restaurantId}`

### **Access:**
- ✅ Company admins can read/write
- ✅ Restaurant staff can read their restaurant

---

## 👤 **USERS**
**Path:** `users/{userId}`

### **Access:**
- ✅ Users can read their own data
- ✅ Users can update their own data
- ✅ Users can create their own profile

---

## 🍽️ **RESTAURANTS (PUBLIC)**
**Path:** `restaurants/{restaurantId}`

### **Access:**
- ✅ Anyone can read restaurant public data
- ✅ Only restaurant staff can write

---

## 🔐 **HELPER FUNCTIONS**

### **`isAuthenticated()`**
- Checks if user is logged in

### **`getUserId()`**
- Returns current user's UID

### **`isRestaurantStaff(restaurantId)`**
- Checks if user exists in `restaurants/{restaurantId}/staff/{userId}`

### **`isReservationOwner(reservationData)`**
- Checks if user is the diner who made the reservation

### **`isCompanyAdmin(companyId)`**
- Checks if user exists in `companies/{companyId}/users/{userId}`

### **`isSchedulePublished(scheduleData)`**
- Checks if schedule status is "published"

---

## ⚠️ **IMPORTANT NOTES**

### **Backend Services:**
- Rules marked "backend only" use Firebase Admin SDK
- Admin SDK bypasses security rules (uses service account)
- All POS events, TipShare transactions, and notifications should be created via Admin SDK

### **Testing:**
- Rules are currently permissive for development (`allow read, write: if true`)
- **IMPORTANT:** Before production, remove the permissive rule and deploy these rules
- Test thoroughly with different user roles

### **Production Deployment:**
```bash
firebase deploy --only firestore:rules
```

### **Rule Testing:**
Use Firebase Emulator Suite to test rules:
```bash
firebase emulators:start --only firestore
```

---

## 🎯 **SECURITY PRINCIPLES**

1. **Least Privilege:** Users can only access what they need
2. **Data Ownership:** Users can only modify their own data
3. **Role-Based Access:** Staff/Admin roles determine access levels
4. **Backend Control:** Critical operations (POS events, transactions) are backend-only
5. **Validation:** Rules validate data structure and constraints

---

**Status:** Security Rules Complete ✅
**Next:** Test rules in emulator, then deploy to production









