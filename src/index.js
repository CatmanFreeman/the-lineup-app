import React from "react";
import ReactDOM from "react-dom/client";
import AppRouter from "./router/AppRouter";
import { AuthProvider } from "./context/AuthContext";
import ArrivalDetectionProvider from "./components/ArrivalDetection/ArrivalDetectionProvider";
import FCMProvider from "./components/FCMProvider/FCMProvider";
import "./index.css";

// Register service worker for FCM background messages
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/firebase-messaging-sw.js")
    .then((registration) => {
      console.log("Service Worker registered:", registration);
    })
    .catch((error) => {
      console.warn("Service Worker registration failed:", error);
    });
}

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AuthProvider>
      <ArrivalDetectionProvider>
        <AppRouter />
      </ArrivalDetectionProvider>
    </AuthProvider>
  </React.StrictMode>
);
