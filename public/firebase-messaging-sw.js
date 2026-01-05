// public/firebase-messaging-sw.js
//
// SERVICE WORKER FOR FIREBASE CLOUD MESSAGING
//
// Handles background push notifications when app is not in foreground

importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Initialize Firebase
firebase.initializeApp({
  apiKey: "AIzaSyD1vStr8O5MgBAiG9G7_Z8JUTTj8bTMa1k",
  authDomain: "thelineupapp-88c99.firebaseapp.com",
  projectId: "thelineupapp-88c99",
  storageBucket: "thelineupapp-88c99.firebasestorage.app",
  messagingSenderId: "898715301467",
  appId: "1:898715301467:web:c4d66930d24aa7aab717e",
});

// Retrieve an instance of Firebase Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message ", payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || "The Lineup";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || "",
    icon: "/logo192.png", // Add your app icon
    badge: "/logo192.png",
    data: {
      actionUrl: payload.data?.actionUrl || null,
      notificationId: payload.data?.notificationId || null,
    },
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener("notificationclick", (event) => {
  console.log("[firebase-messaging-sw.js] Notification click received.");

  event.notification.close();

  const actionUrl = event.notification.data?.actionUrl;
  if (actionUrl) {
    event.waitUntil(
      clients.openWindow(actionUrl)
    );
  }
});








