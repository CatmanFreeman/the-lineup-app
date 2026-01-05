# Next Steps Roadmap
## Moving Forward with Lineup Platform

---

## ✅ **COMPLETED (What We Just Built)**

### **1. Dashboard Integration** ✅
- **Company Dashboard**: Command Center with live restaurant monitoring
- **Restaurant Dashboard**: Reservations Tab with waiting list, check-in/seating
- **Employee Dashboard**: Quick Actions tab for servers
- **Overview Tabs**: Updated to use canonical ledger

### **2. Reservation System Foundation** ✅
- Canonical ledger service
- Availability engine (15-minute slots, tiered scoring)
- Phone verification for LINEUP reservations
- 2-hour cancellation cutoff
- OpenTable integration (webhook + polling + reconciliation)

### **3. Schedule Integration** ✅
- Server selection based on published schedules
- Guests can reserve without schedule
- Auto-notification when schedule is published
- Update reservation metadata to add server

### **4. Automatic Flow** ✅
- Status updates automatically (host actions, POS events)
- Servers see updates without manual work
- Real-time dashboard updates

---

## 🎯 **IMMEDIATE NEXT STEPS (Priority Order)**

### **1. Reservation Page Enhancement** (High Priority)
**What:** Allow guests to update existing reservations to add server selection

**Why:** When schedule is published, guests get notified but need UI to actually select server

**Tasks:**
- [ ] Update `Reservation.jsx` to handle `reservationId` and `selectServer` URL params
- [ ] Load existing reservation when params present
- [ ] Pre-fill form with reservation data
- [ ] Show server selection UI (if schedule published)
- [ ] Add "Update Server" button that calls `updateReservationMetadata()`
- [ ] Show success message after update

**Estimated Time:** 1-2 hours

---

### **2. Scheduled Jobs / Background Tasks** (High Priority)
**What:** Set up automated background processes

**Why:** System needs to run maintenance tasks automatically

**Tasks:**
- [ ] **Waiting List Materialization** (every 5-10 minutes)
  - Cloud Function or scheduled task
  - Calls `materializeWaitingList()` for all restaurants
  - Keeps waiting list up-to-date
  
- [ ] **OpenTable Polling** (every 15-30 minutes)
  - Cloud Function scheduled task
  - Calls `syncOpenTableReservations()` for restaurants with OpenTable enabled
  - Fallback if webhooks fail
  
- [ ] **Reconciliation** (hourly)
  - Cloud Function scheduled task
  - Calls `reconcileOpenTableReservations()` for all restaurants
  - Detects and fixes divergences

**Options:**
- Firebase Cloud Functions with scheduled triggers
- Node.js cron jobs (if you have a backend server)
- External scheduler (AWS EventBridge, etc.)

**Estimated Time:** 2-4 hours (depending on infrastructure)

---

### **3. Firestore Security Rules** (High Priority)
**What:** Secure the reservation ledger and related collections

**Why:** Prevent unauthorized access/modification

**Tasks:**
- [ ] Rules for `restaurants/{id}/reservations/{id}`:
  - Diners can read their own reservations
  - Diners can create reservations
  - Diners can update metadata (server selection) on their reservations
  - Restaurant staff can read all reservations
  - Restaurant staff can update status
  - Backend services can write/update
  
- [ ] Rules for `restaurants/{id}/waitingList/{id}`:
  - Restaurant staff can read/write
  - Backend services can write
  
- [ ] Rules for `restaurants/{id}/schedules/{id}`:
  - Restaurant staff can read/write
  - Employees can read published schedules

**Estimated Time:** 1-2 hours

---

### **4. Meal Lifecycle Tracking** (Medium Priority)
**What:** Track meal progress from seating to check close

**Why:** Provides analytics and real-time status updates

**Tasks:**
- [ ] Create meal lifecycle model in Firestore
- [ ] Update POS event service to track lifecycle
- [ ] Add lifecycle status to reservation metadata
- [ ] Display lifecycle in dashboards
- [ ] Analytics based on lifecycle data

**Estimated Time:** 3-4 hours

---

### **5. OpenTable Configuration UI** (Medium Priority)
**What:** Allow restaurants to configure OpenTable integration

**Why:** Need UI to set up API credentials and enable/disable sync

**Tasks:**
- [ ] Add "Integrations" section to Restaurant Dashboard Settings
- [ ] OpenTable configuration form:
  - API credentials input
  - Enable/disable toggle
  - Sync status indicator
  - Last sync timestamp
  - Manual sync button
- [ ] Store config in Firestore (encrypted)
- [ ] Test connection button

**Estimated Time:** 2-3 hours

---

### **6. Webhook Endpoints** (Medium Priority)
**What:** Deploy webhook receivers for external systems

**Why:** Real-time integration with OpenTable and Toast

**Tasks:**
- [ ] Deploy OpenTable webhook receiver endpoint
  - Verify signatures
  - Handle reservation events
  - Normalize and store
  
- [ ] Deploy Toast webhook receiver endpoint
  - Verify signatures
  - Handle POS events
  - Update meal lifecycle

**Options:**
- Firebase Cloud Functions (HTTP triggers)
- Express.js server
- Serverless framework

**Estimated Time:** 3-4 hours

---

### **7. Testing & Validation** (Ongoing)
**What:** Test all flows end-to-end

**Tasks:**
- [ ] Test reservation creation (with/without schedule)
- [ ] Test schedule publish notification
- [ ] Test server selection update
- [ ] Test waiting list materialization
- [ ] Test check-in/seat flow
- [ ] Test OpenTable webhook (mock)
- [ ] Test POS event processing (mock)
- [ ] Test dashboard updates

**Estimated Time:** 2-3 hours

---

### **8. Performance Optimization** (Low Priority)
**What:** Optimize queries and reduce costs

**Tasks:**
- [ ] Add Firestore indexes for reservation queries
- [ ] Optimize waiting list queries
- [ ] Cache frequently accessed data
- [ ] Reduce polling frequency where possible
- [ ] Use Firestore listeners instead of polling (where appropriate)

**Estimated Time:** 2-3 hours

---

## 📋 **RECOMMENDED ORDER OF EXECUTION**

### **Week 1: Core Functionality**
1. ✅ Reservation Page Enhancement (server selection update)
2. ✅ Firestore Security Rules
3. ✅ Basic Testing

### **Week 2: Automation**
4. ✅ Scheduled Jobs (waiting list, OpenTable polling, reconciliation)
5. ✅ Webhook Endpoints (if needed)

### **Week 3: Polish**
6. ✅ OpenTable Configuration UI
7. ✅ Meal Lifecycle Tracking
8. ✅ Performance Optimization

---

## 🚀 **QUICK WINS (Can Do Now)**

### **1. Reservation Page Server Selection Update** ⚡
**Impact:** High - Completes the schedule publish flow
**Effort:** Low - 1-2 hours
**Status:** Ready to implement

### **2. Firestore Security Rules** ⚡
**Impact:** High - Security critical
**Effort:** Low - 1-2 hours
**Status:** Ready to implement

### **3. Basic Scheduled Jobs** ⚡
**Impact:** Medium - Keeps system running
**Effort:** Medium - 2-3 hours
**Status:** Need to decide infrastructure (Cloud Functions vs. cron)

---

## 💡 **DECISIONS NEEDED**

1. **Scheduled Jobs Infrastructure:**
   - Firebase Cloud Functions? (recommended for Firebase projects)
   - Node.js cron on existing server?
   - External scheduler?

2. **Webhook Infrastructure:**
   - Firebase Cloud Functions HTTP triggers?
   - Express.js server?
   - Serverless framework?

3. **OpenTable API Credentials:**
   - Do you have OpenTable API access?
   - Need to set up sandbox/testing environment?

4. **Toast Integration:**
   - Do you have Toast API credentials?
   - Need to set up webhook endpoints?

---

## 🎯 **RECOMMENDATION: Start Here**

**I recommend starting with:**

1. **Reservation Page Enhancement** (1-2 hours)
   - Completes the schedule publish notification flow
   - Users can actually select servers when notified
   - High user value, low effort

2. **Firestore Security Rules** (1-2 hours)
   - Critical for security
   - Prevents data leaks
   - Should be done before production

3. **Basic Scheduled Job** (2-3 hours)
   - Waiting list materialization
   - Keeps system operational
   - Can start with one job, add others later

**Total: 4-7 hours of work to get core functionality complete and secure.**

---

**Which would you like to tackle first?**









