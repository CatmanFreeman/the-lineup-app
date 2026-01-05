# Valet Company Signup & Application Flow Implementation

## Overview

This document describes the complete signup and application flow for valet companies and drivers, implementing the user's vision of a partnership model where valet companies apply to restaurants (like employees) and drivers apply to valet companies.

## Signup Flow

### 1. Signup Selection Page (`/signup`)

**New Page:** `SignupSelection.jsx`

Users see two options:
- **Restaurant** - For restaurant owners/operators
- **Valet Company** - For valet service providers

Clicking "Valet Company" navigates to `/signup/valet-company`

### 2. Valet Company Signup (`/signup/valet-company`)

**New Page:** `SignupValetCompany.jsx`

Valet companies create their company profile:
- Company name
- Contact information (name, email, phone)
- Address
- Company logo (optional)
- Login credentials (email/password)

**What Happens:**
1. Creates Firebase Auth user
2. Creates valet company in `valetCompanies/{companyId}` collection
3. Creates user profile with role `VALET_COMPANY_ADMIN`
4. Links user to valet company via `valetCompanyId` and `companyId`
5. Redirects to valet company dashboard (to be created)

## Application Flow

### 3. Valet Company Applies to Restaurant

**Service:** `valetCompanyService.applyToRestaurant()`

**Flow:**
1. Valet company admin selects a restaurant
2. Calls `applyToRestaurant()` with:
   - `valetCompanyId`
   - `restaurantId`
   - `requestedBy` (admin user ID)
3. Creates application in `restaurants/{restaurantId}/valetApplications/{applicationId}`
4. Status: `PENDING`
5. Restaurant managers get notification

**Restaurant Approval:**
- Restaurant manager sees application in "Valet Companies" tab
- Can approve or reject
- If approved:
  - Application status → `APPROVED`
  - Creates authorization record in `restaurants/{restaurantId}/valetAuthorizations/{valetCompanyId}`
  - Valet company drivers get notified

### 4. Valet Driver Applies to Valet Company

**Service:** `valetDriverApplicationService.applyToValetCompany()`

**Flow:**
1. User signs up like a diner (regular user signup)
2. User navigates to `/apply/valet-company`
3. Selects valet company (and optionally restaurant location)
4. Calls `applyToValetCompany()` with:
   - `driverId` (user ID)
   - `valetCompanyId`
   - `restaurantId` (optional)
   - Driver info (name, email, phone)
5. Creates application in `valetCompanies/{valetCompanyId}/driverApplications/{applicationId}`
6. Status: `PENDING`
7. Valet company admin gets notification

**Valet Company Approval:**
- Valet company admin sees application
- Can approve or reject
- If approved:
  - Application status → `APPROVED`
  - Calls `registerValetDriver()` to:
    - Update user profile with `role: "VALET"`
    - Set `valetCompanyId`, `restaurantId`, `organization`
    - Add driver to company's drivers list
  - Driver gets notification
  - Driver can now access Valet Driver Dashboard

## Data Structure

### Valet Company
```
valetCompanies/{companyId}
  - name: string
  - contactName: string
  - contactEmail: string
  - contactPhone: string
  - address: string
  - adminUserId: string (company admin)
  - drivers: [userId1, userId2, ...]
  - logoURL: string
  - status: "ACTIVE" | "SUSPENDED"
```

### Valet Company Application (to Restaurant)
```
restaurants/{restaurantId}/valetApplications/{applicationId}
  - valetCompanyId: string
  - restaurantId: string
  - status: "PENDING" | "APPROVED" | "REJECTED"
  - requestedBy: userId
  - requestedAt: timestamp
  - approvedBy: userId (if approved/rejected)
  - approvedAt: timestamp
```

### Valet Company Authorization (Approved Application)
```
restaurants/{restaurantId}/valetAuthorizations/{valetCompanyId}
  - valetCompanyId: string
  - restaurantId: string
  - status: "APPROVED"
  - approvedBy: userId
  - approvedAt: timestamp
```

### Valet Driver Application (to Valet Company)
```
valetCompanies/{valetCompanyId}/driverApplications/{applicationId}
  - driverId: userId
  - valetCompanyId: string
  - restaurantId: string (optional)
  - driverName: string
  - driverEmail: string
  - driverPhone: string
  - status: "PENDING" | "APPROVED" | "REJECTED"
  - appliedAt: timestamp
  - approvedBy: userId (if approved/rejected)
  - approvedAt: timestamp
```

### Valet Driver User Profile
```
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
```

## User Roles

1. **VALET_COMPANY_ADMIN**
   - Valet company owner/admin
   - Can manage drivers
   - Can apply to restaurants
   - Can approve/reject driver applications

2. **VALET**
   - Valet driver (user, not employee)
   - Assigned to valet company and restaurant
   - Can access Valet Driver Dashboard
   - Gets notifications for car retrieval

## Rating System (Future Enhancement)

Driver ratings should aggregate to valet company's overall rating:
- When diner rates valet service, rating applies to:
  - Individual driver (if specified)
  - Valet company (aggregated)
- Valet company's `liveRating` = average of all driver ratings

## Routes

- `/signup` - Signup selection (Restaurant or Valet Company)
- `/signup/valet-company` - Valet company signup
- `/apply/valet-company` - Driver applies to valet company
- `/dashboard/valet/{restaurantId}` - Valet driver dashboard
- `/dashboard/valet-company/{companyId}` - Valet company dashboard (to be created)

## Benefits

1. **Partnership Model**
   - Valet companies are partners, not competitors
   - Application-based association (like employees)
   - Restaurant controls who provides valet services

2. **User Onboarding**
   - Drivers sign up like diners (familiar flow)
   - Simple application process
   - Clear approval workflow

3. **Technology Replacement**
   - App handles all notifications and workflow
   - Valet companies can use paper tickets
   - Drivers just drive cars

4. **Scalability**
   - Multiple valet companies per restaurant
   - Drivers can work at multiple locations
   - Easy to add/remove drivers

## Next Steps

1. **Valet Company Dashboard** (to be created)
   - View driver applications
   - Approve/reject drivers
   - Manage drivers
   - View activity metrics

2. **Rating Aggregation**
   - Aggregate driver ratings to company
   - Display company rating
   - Track individual driver performance

3. **Multi-Location Support**
   - Drivers assigned to multiple restaurants
   - Company-wide activity view








