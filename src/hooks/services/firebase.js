import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getMessaging, isSupported } from "firebase/messaging";


const firebaseConfig = {
  apiKey: "AIzaSyD1vStr8O5MgBAiG9G7_Z8JUTTj8bTMa1k",
  authDomain: "thelineupapp-88c99.firebaseapp.com",
  projectId: "thelineupapp-88c99",
  storageBucket: "thelineupapp-88c99.firebasestorage.app",
  messagingSenderId: "898715301467",
  appId: "1:898715301467:web:c4d66930d24aa7aab717e",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// Initialize messaging (only in browser, and if supported)
let messaging = null;
if (typeof window !== "undefined") {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app);
    }
  });
}
export { messaging };