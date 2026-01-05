# Scheduled Jobs Implementation
## Firebase Cloud Functions for Automated Tasks

### ✅ **IMPLEMENTED SCHEDULED JOBS**

---

## 📋 **1. WAITING LIST MATERIALIZATION**
**Schedule:** Every 5 minutes  
**Function:** `materializeWaitingLists`

**What it does:**
- Runs every 5 minutes automatically
- Gets all restaurants from Firestore
- For each restaurant:
  - Queries canonical ledger for reservations in next 24 hours
  - Filters for active statuses (BOOKED, CONFIRMED, CHECKED_IN, SEATED)
  - Clears existing waiting list
  - Creates new waiting list entries with priority scores
  - Calculates priority: CHECKED_IN (1) > SEATED (2) > CONFIRMED (3) > BOOKED (4)
  - Adds time-based component to priority

**Manual Trigger:**
- HTTP endpoint: `https://[region]-[project].cloudfunctions.net/manualMaterializeWaitingList?restaurantId=123`
- For testing and manual runs

---

## 🔄 **2. OPENTABLE POLLING**
**Schedule:** Every 15 minutes  
**Function:** `pollOpenTableReservations`

**What it does:**
- Runs every 15 minutes automatically
- Gets all restaurants with OpenTable integration enabled
- For each restaurant:
  - Calls OpenTable API to fetch reservations
  - Normalizes OpenTable data to Lineup schema
  - Creates/updates reservations in canonical ledger
  - Acts as fallback if webhooks fail

**Manual Trigger:**
- HTTP endpoint: `https://[region]-[project].cloudfunctions.net/manualOpenTableSync?restaurantId=123`
- For testing and manual syncs

**Note:** Currently has placeholder implementation. Needs OpenTable API credentials and actual API calls.

---

## 🔍 **3. RECONCILIATION**
**Schedule:** Every hour  
**Function:** `reconcileOpenTableReservations`

**What it does:**
- Runs every hour automatically
- Gets all restaurants with OpenTable integration enabled
- For each restaurant:
  - Fetches reservations from OpenTable API
  - Compares with canonical ledger
  - Identifies divergences:
    - Reservations in OpenTable but not in ledger → Create
    - Reservations in ledger but not in OpenTable → Mark as cancelled
    - Status mismatches → Update status
  - Stores reconciliation report
  - Updates reconciliation metadata

**Manual Trigger:**
- Can be triggered via Firebase Console or HTTP endpoint (to be added)

**Note:** Currently has placeholder implementation. Needs OpenTable API credentials and actual reconciliation logic.

---

## 🚀 **DEPLOYMENT**

### **Prerequisites:**
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Firebase project initialized: `firebase init functions`
3. Node.js 18+ installed

### **Setup:**
```bash
# Install dependencies
cd functions
npm install

# Test locally (if using emulator)
firebase emulators:start --only functions

# Deploy all functions
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:materializeWaitingLists
```

### **Deployment Commands:**
```bash
# Deploy all scheduled jobs
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:materializeWaitingLists
firebase deploy --only functions:pollOpenTableReservations
firebase deploy --only functions:reconcileOpenTableReservations
```

---

## 📊 **MONITORING**

### **View Logs:**
```bash
# View all function logs
firebase functions:log

# View specific function logs
firebase functions:log --only materializeWaitingLists
```

### **Firebase Console:**
- Go to Firebase Console → Functions
- View execution history, logs, and errors
- Monitor execution counts and durations

---

## ⚙️ **CONFIGURATION**

### **Schedule Intervals:**
Current schedules can be adjusted in `functions/index.js`:

```javascript
// Every 5 minutes
.schedule("every 5 minutes")

// Every 15 minutes
.schedule("every 15 minutes")

// Every hour
.schedule("every 1 hours")

// Custom cron (e.g., every day at 2 AM)
.schedule("0 2 * * *")
```

### **OpenTable Integration:**
To enable OpenTable polling for a restaurant, add to Firestore:
```javascript
{
  integrations: {
    opentable: {
      enabled: true,
      apiKey: "...",
      restaurantId: "...",
      // other config
    }
  }
}
```

---

## 🧪 **TESTING**

### **Local Testing:**
```bash
# Start emulator
firebase emulators:start --only functions

# Trigger function manually
curl http://localhost:5001/thelineupapp-88c99/us-central1/manualMaterializeWaitingList?restaurantId=123
```

### **Manual Triggers:**
- **Waiting List:** `https://[region]-[project].cloudfunctions.net/manualMaterializeWaitingList?restaurantId=123`
- **OpenTable Sync:** `https://[region]-[project].cloudfunctions.net/manualOpenTableSync?restaurantId=123`

---

## ⚠️ **IMPORTANT NOTES**

1. **Firestore Indexes:**
   - The waiting list materialization query may need composite indexes
   - Check Firebase Console for index creation prompts
   - Or add to `firestore.indexes.json`

2. **OpenTable API:**
   - Currently placeholder implementations
   - Need to add actual OpenTable API calls
   - Requires OpenTable API credentials

3. **Error Handling:**
   - Functions use `Promise.allSettled` to continue even if some restaurants fail
   - Errors are logged to Firebase Functions logs
   - Failed restaurants don't block others

4. **Cost Considerations:**
   - Each function execution counts toward Firebase Functions quota
   - Waiting list: ~288 executions/day (every 5 min)
   - OpenTable polling: ~96 executions/day (every 15 min)
   - Reconciliation: ~24 executions/day (hourly)

5. **Batch Limits:**
   - Firestore batch limit: 500 operations
   - Functions handle batching automatically for large datasets

---

## 🔧 **NEXT STEPS**

1. **Deploy Functions:**
   ```bash
   cd functions
   npm install
   firebase deploy --only functions
   ```

2. **Add Firestore Indexes:**
   - Check Firebase Console for index creation prompts
   - Or manually add to `firestore.indexes.json`

3. **Implement OpenTable API Calls:**
   - Add OpenTable API client
   - Implement actual sync logic
   - Add error handling and retries

4. **Monitor:**
   - Check Firebase Console → Functions
   - Review logs for errors
   - Monitor execution counts

---

**Status:** Scheduled Jobs Structure Complete ✅  
**Next:** Deploy functions and implement OpenTable API calls









