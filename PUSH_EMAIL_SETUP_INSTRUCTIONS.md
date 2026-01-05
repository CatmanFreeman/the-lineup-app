# 🔔 Push & Email Notifications Setup Instructions

## Overview

Push notifications (FCM) and email notifications have been implemented. Follow these steps to complete the setup.

---

## 📱 **PUSH NOTIFICATIONS (FCM) SETUP**

### **Step 1: Generate VAPID Key**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: `thelineupapp-88c99`
3. Navigate to **Project Settings** (gear icon) → **Cloud Messaging** tab
4. Under **Web Push certificates**, click **Generate key pair**
5. Copy the generated key

### **Step 2: Add VAPID Key to Environment**

Create a `.env` file in the project root (if it doesn't exist):

```env
REACT_APP_FCM_VAPID_KEY=YOUR_VAPID_KEY_HERE
```

**Important:** Add `.env` to `.gitignore` to keep the key secure.

### **Step 3: Deploy Cloud Functions**

The push notification Cloud Function is already created. Deploy it:

```bash
cd functions
npm install
firebase deploy --only functions:sendPushNotification
```

### **Step 4: Test Push Notifications**

1. Open the app in a browser
2. Log in as a user
3. The app will automatically request notification permission
4. Create a HIGH or MEDIUM priority notification
5. You should receive a push notification

---

## 📧 **EMAIL NOTIFICATIONS SETUP**

### **Step 1: Get SendGrid API Key**

1. Sign up for [SendGrid](https://sendgrid.com/) (free tier available)
2. Go to **Settings** → **API Keys**
3. Click **Create API Key**
4. Name it "Lineup Platform"
5. Select **Full Access** or **Restricted Access** (with Mail Send permission)
6. Copy the API key

### **Step 2: Configure SendGrid in Firebase**

Set the SendGrid API key in Firebase Functions config:

```bash
firebase functions:config:set sendgrid.api_key="YOUR_SENDGRID_API_KEY"
firebase functions:config:set sendgrid.from_email="noreply@thelineup.app"
firebase functions:config:set sendgrid.from_name="The Lineup"
```

**Note:** Replace `noreply@thelineup.app` with your verified SendGrid sender email.

### **Step 3: Verify Sender Email in SendGrid**

1. Go to **Settings** → **Sender Authentication**
2. Verify your sender email address
3. This is required before you can send emails

### **Step 4: Deploy Cloud Functions**

Deploy the email notification function:

```bash
cd functions
npm install  # Installs @sendgrid/mail
firebase deploy --only functions:sendEmailNotification,functions:sendEmail
```

### **Step 5: Test Email Notifications**

1. Create a HIGH or MEDIUM priority notification
2. Check the user's email inbox
3. Verify email was sent successfully

---

## 🧪 **TESTING**

### **Test Push Notifications**

1. **Manual Test:**
   ```javascript
   // In browser console
   import { createNotification } from './utils/notificationService';
   await createNotification({
     userId: 'YOUR_USER_ID',
     type: 'TEST',
     priority: 'high',
     title: 'Test Push',
     message: 'This is a test push notification',
   });
   ```

2. **Check Firestore:**
   - Go to `notifications` collection
   - Verify notification was created
   - Check `pushSent: true` after Cloud Function runs

### **Test Email Notifications**

1. **Manual Test:**
   ```javascript
   // In browser console
   import { createNotification } from './utils/notificationService';
   await createNotification({
     userId: 'YOUR_USER_ID',
     type: 'TEST',
     priority: 'high',
     title: 'Test Email',
     message: 'This is a test email notification',
   });
   ```

2. **Check Email Inbox:**
   - Verify email was received
   - Check Firestore `notifications` collection
   - Verify `emailSent: true`

---

## 🔧 **TROUBLESHOOTING**

### **Push Notifications Not Working**

1. **Check VAPID Key:**
   - Verify `.env` file has `REACT_APP_FCM_VAPID_KEY`
   - Restart dev server after adding env variable
   - Check browser console for errors

2. **Check Service Worker:**
   - Open DevTools → Application → Service Workers
   - Verify `firebase-messaging-sw.js` is registered
   - Check for errors in service worker

3. **Check Browser Support:**
   - FCM requires HTTPS (or localhost)
   - Some browsers may not support FCM
   - Check browser console for warnings

4. **Check Cloud Function:**
   - Verify function is deployed
   - Check Firebase Console → Functions → Logs
   - Look for errors in function execution

### **Email Notifications Not Working**

1. **Check SendGrid Config:**
   - Verify API key is set: `firebase functions:config:get`
   - Check sender email is verified in SendGrid
   - Verify SendGrid account is active

2. **Check Cloud Function:**
   - Verify function is deployed
   - Check Firebase Console → Functions → Logs
   - Look for SendGrid API errors

3. **Check User Email:**
   - Verify user has email in Firestore
   - Check email preferences (defaults to enabled)
   - Check spam folder

---

## 📋 **NOTIFICATION PRIORITIES**

- **HIGH:** Push + Email + In-App
- **MEDIUM:** Email + In-App
- **LOW:** In-App only

Notifications are automatically sent based on priority when created via `createNotification()`.

---

## 🎯 **NEXT STEPS**

1. ✅ Generate VAPID key and add to `.env`
2. ✅ Set up SendGrid account and API key
3. ✅ Configure Firebase Functions config
4. ✅ Deploy Cloud Functions
5. ✅ Test push and email notifications
6. ✅ Monitor Firebase Console for errors

---

## 📝 **NOTES**

- **VAPID Key:** Required for web push notifications. Generate once in Firebase Console.
- **SendGrid:** Free tier allows 100 emails/day. Upgrade for production.
- **Service Worker:** Must be in `public/` folder to be accessible.
- **HTTPS Required:** Push notifications require HTTPS (except localhost).
- **Email Preferences:** Users can disable email notifications in profile settings (to be implemented).

---

**Last Updated:** January 2025








