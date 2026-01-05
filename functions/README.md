# Firebase Cloud Functions
## Scheduled Jobs for Reservation System

## 📦 **Setup**

```bash
# Install dependencies
npm install

# Test locally
npm run serve

# Deploy
npm run deploy
```

## 🔄 **Scheduled Functions**

### 1. **materializeWaitingLists**
- **Schedule:** Every 5 minutes
- **Purpose:** Materialize waiting list from canonical ledger
- **Runs for:** All restaurants

### 2. **pollOpenTableReservations**
- **Schedule:** Every 15 minutes
- **Purpose:** Poll OpenTable API for reservations
- **Runs for:** Restaurants with OpenTable enabled

### 3. **reconcileOpenTableReservations**
- **Schedule:** Every hour
- **Purpose:** Reconcile OpenTable data with ledger
- **Runs for:** Restaurants with OpenTable enabled

## 🧪 **Manual Triggers**

### Waiting List Materialization
```
GET https://[region]-[project].cloudfunctions.net/manualMaterializeWaitingList?restaurantId=123
```

### OpenTable Sync
```
GET https://[region]-[project].cloudfunctions.net/manualOpenTableSync?restaurantId=123
```

## 📝 **Notes**

- Functions use Firebase Admin SDK (bypasses security rules)
- OpenTable functions need API credentials to be implemented
- Check Firebase Console for execution logs and errors









