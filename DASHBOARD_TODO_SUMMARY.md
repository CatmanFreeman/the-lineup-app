# Dashboard TODO Summary

## 🔴 **CRITICAL - Must Fix**

### 1. **Restaurant Dashboard - VerificationsTab**
**File:** `src/pages/Dashboards/RestaurantDashboard/tabs/VerificationsTab.jsx`
**Issue:** Using placeholder `"current-user-id"` instead of actual authenticated user
**Lines:** 75, 103
**Fix Needed:**
```javascript
// Add at top:
import { useAuth } from "../../../../context/AuthContext";

// In component:
const { currentUser } = useAuth();
const verifiedBy = currentUser?.uid || "system";
const rejectedBy = currentUser?.uid || "system";
```

### 2. **Restaurant Dashboard - ValetTab**
**File:** `src/pages/Dashboards/RestaurantDashboard/tabs/ValetTab.jsx`
**Issue:** Using placeholder `"valet"` instead of actual staff member ID
**Lines:** 121, 134-135
**Fix Needed:**
```javascript
// Add auth context:
import { useAuth } from "../../../../context/AuthContext";

// Get actual staff member:
const { currentUser } = useAuth();
// Load staff data to get name from staff collection
```

---

## 🟡 **IMPORTANT - Should Complete**

### 3. **Company Dashboard - Trend Calculations**
**File:** `src/pages/Dashboards/CompanyDashboard/CompanyDashboard.jsx`
**Issue:** Trends (alcohol, waste, labor) are set to `null` - not calculated
**Lines:** 825-827
**Fix Needed:**
- Calculate month-over-month trends for each restaurant
- Compare current month data vs previous month
- Display up/down arrows based on trend direction
- Already has `previousMonthData` state - needs calculation logic

### 4. **Employee Dashboard - Messaging Tab**
**File:** `src/pages/Dashboards/EmployeeDashboard/EmployeeDashboard.jsx`
**Issue:** Messaging tab is disabled with placeholder message
**Lines:** 570-578
**Fix Needed:**
- Re-enable MessagingTab component (currently commented out at line 28)
- Uncomment: `import MessagingTab from "./MessagingTab";`
- Replace placeholder with actual `<MessagingTab />` component

---

## 🟢 **NICE TO HAVE - Future Enhancements**

### 5. **Restaurant Dashboard - LiveOperationsTab**
**File:** `src/pages/Dashboards/RestaurantDashboard/tabs/LiveOperationsTab.jsx`
**Issue:** Square & Clover POS systems marked as "coming soon"
**Line:** 472
**Status:** Currently only Toast is active
**Note:** This is a feature enhancement, not a bug

### 6. **Restaurant Dashboard - OrientationManager**
**File:** `src/pages/Dashboards/RestaurantDashboard/tabs/OrientationManager.jsx`
**Issue:** `updatedBy: "manager"` placeholder
**Line:** 214
**Fix Needed:** Get actual manager ID from auth context

---

## 📋 **Summary by Priority**

### **High Priority (Auth Issues)**
1. ✅ VerificationsTab - Get current user ID
2. ✅ ValetTab - Get actual staff member ID
3. ✅ OrientationManager - Get manager ID

### **Medium Priority (Features)**
4. ✅ Company Dashboard - Calculate trends
5. ✅ Employee Dashboard - Re-enable messaging

### **Low Priority (Future)**
6. ⏳ LiveOperationsTab - Add Square & Clover POS support

---

## 🛠️ **Quick Fixes Needed**

1. **Add auth context to VerificationsTab** - 5 min
2. **Add auth context to ValetTab** - 5 min  
3. **Add auth context to OrientationManager** - 5 min
4. **Re-enable MessagingTab** - 2 min
5. **Calculate trends in Company Dashboard** - 30 min

**Total Estimated Time:** ~1 hour for critical fixes








