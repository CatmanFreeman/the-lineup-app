/**
 * Firebase Cloud Functions
 * Scheduled Jobs, Push Notifications, and Email Service
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const sgMail = require("@sendgrid/mail");

admin.initializeApp();
const db = admin.firestore();

// Initialize SendGrid (set API key in Firebase config or environment)
const SENDGRID_API_KEY = functions.config().sendgrid?.api_key || process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

// ============================================
// SCHEDULED JOB: Waiting List Materialization
// Runs every 5 minutes
// ============================================
exports.materializeWaitingLists = functions.pubsub
    .schedule("every 5 minutes")
    .onRun(async (context) => {
      console.log("Starting waiting list materialization...");

      try {
      // Get all restaurants
        const restaurantsSnapshot = await db.collection("restaurants").get();
        const restaurantIds = restaurantsSnapshot.docs.map((doc) => doc.id);

        console.log(`Materializing waiting lists for ${restaurantIds.length} restaurants...`);

        // Materialize waiting list for each restaurant
        const results = await Promise.allSettled(
            restaurantIds.map(async (restaurantId) => {
              try {
                await materializeWaitingListForRestaurant(restaurantId);
                return {restaurantId, success: true};
              } catch (error) {
                console.error(`Error materializing waiting list for ${restaurantId}:`, error);
                return {restaurantId, success: false, error: error.message};
              }
            }),
        );

        const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
        const failed = results.length - successful;

        console.log(`Waiting list materialization complete: ${successful} successful, ${failed} failed`);

        return {
          success: true,
          total: restaurantIds.length,
          successful,
          failed,
        };
      } catch (error) {
        console.error("Error in waiting list materialization job:", error);
        throw error;
      }
    });

/**
 * Materialize waiting list for a single restaurant
 * This replicates the logic from waitingListService.js
 * @param {string} restaurantId - The restaurant ID
 */
async function materializeWaitingListForRestaurant(restaurantId) {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(23, 59, 59, 999);

  // Get all reservations for next 24 hours from canonical ledger
  const reservationsRef = db.collection("restaurants").doc(restaurantId).collection("reservations");

  // Query reservations in the 24-hour window
  // Note: Firestore queries require indexes for compound queries
  // We'll get all active reservations and filter in memory for now
  const reservationsSnapshot = await reservationsRef
      .where("startAt", ">=", now.toISOString())
      .where("startAt", "<=", tomorrow.toISOString())
      .get();

  // Filter for active statuses
  const activeStatuses = ["BOOKED", "CONFIRMED", "CHECKED_IN", "SEATED"];
  const reservations = reservationsSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      .filter((r) => activeStatuses.includes(r.status));

  // Clear existing waiting list
  const waitingListRef = db.collection("restaurants").doc(restaurantId).collection("waitingList");
  const existingSnapshot = await waitingListRef.get();

  // Delete in batches (Firestore batch limit is 500)
  const deleteBatches = [];
  let currentBatch = db.batch();
  let count = 0;

  existingSnapshot.docs.forEach((doc) => {
    if (count >= 500) {
      deleteBatches.push(currentBatch);
      currentBatch = db.batch();
      count = 0;
    }
    currentBatch.delete(doc.ref);
    count++;
  });
  if (count > 0) {
    deleteBatches.push(currentBatch);
  }

  await Promise.all(deleteBatches.map((batch) => batch.commit()));

  // Create new waiting list entries
  const createBatches = [];
  currentBatch = db.batch();
  count = 0;

  reservations.forEach((reservation) => {
    if (count >= 500) {
      createBatches.push(currentBatch);
      currentBatch = db.batch();
      count = 0;
    }

    const entryRef = waitingListRef.doc(reservation.id);
    const startAt = reservation.startAtTimestamp?.toDate?.() || new Date(reservation.startAt);

    // Calculate priority score (lower = higher priority)
    let priorityScore = 0;
    if (reservation.status === "CHECKED_IN") priorityScore = 1;
    else if (reservation.status === "SEATED") priorityScore = 2;
    else if (reservation.status === "CONFIRMED") priorityScore = 3;
    else priorityScore = 4;

    // Add time-based priority (earlier = higher priority)
    const minutesUntil = Math.round((startAt - now) / (1000 * 60));
    priorityScore += Math.max(0, minutesUntil) / 1000; // Add small time component

    currentBatch.set(entryRef, {
      reservationId: reservation.id,
      dinerId: reservation.dinerId,
      dinerName: reservation.dinerName || "Guest",
      startAt: reservation.startAt,
      partySize: reservation.partySize || 1,
      status: reservation.status,
      phone: reservation.phone || null,
      source: reservation.source || {system: "LINEUP"},
      metadata: reservation.metadata || {},
      priorityScore,
      hostNotes: null,
      isCheckedIn: reservation.status === "CHECKED_IN" || reservation.status === "SEATED",
      materializedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    count++;
  });

  if (count > 0) {
    createBatches.push(currentBatch);
  }

  await Promise.all(createBatches.map((batch) => batch.commit()));
  console.log(`Materialized ${reservations.length} reservations for restaurant ${restaurantId}`);
}

// ============================================
// SCHEDULED JOB: OpenTable Polling
// Runs every 15 minutes
// ============================================
exports.pollOpenTableReservations = functions.pubsub
    .schedule("every 15 minutes")
    .onRun(async (context) => {
      console.log("Starting OpenTable polling...");

      try {
      // Get restaurants with OpenTable enabled
        const restaurantsSnapshot = await db.collection("restaurants").get();
        const restaurantsWithOpenTable = [];

        restaurantsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          // Check if restaurant has OpenTable integration enabled
          if (data.integrations?.opentable?.enabled) {
            restaurantsWithOpenTable.push({
              id: doc.id,
              ...data,
            });
          }
        });

        console.log(`Found ${restaurantsWithOpenTable.length} restaurants with OpenTable enabled`);

        if (restaurantsWithOpenTable.length === 0) {
          console.log("No restaurants with OpenTable integration found");
          return {success: true, message: "No OpenTable integrations found"};
        }

        // Poll each restaurant
        const results = await Promise.allSettled(
            restaurantsWithOpenTable.map(async (restaurant) => {
              try {
                await syncOpenTableReservationsForRestaurant(restaurant);
                return {restaurantId: restaurant.id, success: true};
              } catch (error) {
                console.error(`Error syncing OpenTable for ${restaurant.id}:`, error);
                return {restaurantId: restaurant.id, success: false, error: error.message};
              }
            }),
        );

        const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
        const failed = results.length - successful;

        console.log(`OpenTable polling complete: ${successful} successful, ${failed} failed`);

        return {
          success: true,
          total: restaurantsWithOpenTable.length,
          successful,
          failed,
        };
      } catch (error) {
        console.error("Error in OpenTable polling job:", error);
        throw error;
      }
    });

/**
 * Sync OpenTable reservations for a restaurant
 * @param {Object} restaurant - The restaurant object with id and integrations
 */
async function syncOpenTableReservationsForRestaurant(restaurant) {
  // This would call the OpenTable API
  // For now, we'll use the service function from the codebase
  // In production, you'd import the actual service

  console.log(`Syncing OpenTable reservations for restaurant ${restaurant.id}`);

  // TODO: Implement actual OpenTable API call
  // const { syncOpenTableReservations } = require("../src/utils/opentableService");
  // await syncOpenTableReservations(restaurant.id, restaurant.integrations.opentable);

  // For now, just log
  console.log(`OpenTable sync for ${restaurant.id} - placeholder implementation`);
}

// ============================================
// SCHEDULED JOB: Reconciliation
// Runs every hour
// ============================================
exports.reconcileOpenTableReservations = functions.pubsub
    .schedule("every 1 hours")
    .onRun(async (context) => {
      console.log("Starting OpenTable reconciliation...");

      try {
      // Get restaurants with OpenTable enabled
        const restaurantsSnapshot = await db.collection("restaurants").get();
        const restaurantsWithOpenTable = [];

        restaurantsSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          if (data.integrations?.opentable?.enabled) {
            restaurantsWithOpenTable.push({
              id: doc.id,
              ...data,
            });
          }
        });

        console.log(`Reconciling ${restaurantsWithOpenTable.length} restaurants with OpenTable`);

        if (restaurantsWithOpenTable.length === 0) {
          console.log("No restaurants with OpenTable integration found");
          return {success: true, message: "No OpenTable integrations found"};
        }

        // Reconcile each restaurant
        const results = await Promise.allSettled(
            restaurantsWithOpenTable.map(async (restaurant) => {
              try {
                await reconcileOpenTableForRestaurant(restaurant);
                return {restaurantId: restaurant.id, success: true};
              } catch (error) {
                console.error(`Error reconciling OpenTable for ${restaurant.id}:`, error);
                return {restaurantId: restaurant.id, success: false, error: error.message};
              }
            }),
        );

        const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;
        const failed = results.length - successful;

        console.log(`Reconciliation complete: ${successful} successful, ${failed} failed`);

        return {
          success: true,
          total: restaurantsWithOpenTable.length,
          successful,
          failed,
        };
      } catch (error) {
        console.error("Error in reconciliation job:", error);
        throw error;
      }
    });

/**
 * Reconcile OpenTable reservations for a restaurant
 * @param {Object} restaurant - The restaurant object with id and integrations
 */
async function reconcileOpenTableForRestaurant(restaurant) {
  console.log(`Reconciling OpenTable reservations for restaurant ${restaurant.id}`);

  // This would compare OpenTable API data with ledger
  // and fix any divergences

  // TODO: Implement actual reconciliation logic
  // const { reconcileOpenTableReservations } = require("../src/utils/opentableReconciliationService");
  // await reconcileOpenTableReservations(restaurant.id, restaurant.integrations.opentable);

  // For now, just log
  console.log(`Reconciliation for ${restaurant.id} - placeholder implementation`);
}

// ============================================
// HTTP TRIGGER: Manual Materialization
// For testing and manual triggers
// ============================================
exports.manualMaterializeWaitingList = functions.https.onRequest(async (req, res) => {
  const restaurantId = req.query.restaurantId;

  if (!restaurantId) {
    res.status(400).json({error: "restaurantId query parameter required"});
    return;
  }

  try {
    await materializeWaitingListForRestaurant(restaurantId);
    res.json({success: true, restaurantId});
  } catch (error) {
    console.error("Error in manual materialization:", error);
    res.status(500).json({error: error.message});
  }
});

// ============================================
// HTTP TRIGGER: Manual OpenTable Sync
// For testing and manual triggers
// ============================================
exports.manualOpenTableSync = functions.https.onRequest(async (req, res) => {
  const restaurantId = req.query.restaurantId;

  if (!restaurantId) {
    res.status(400).json({error: "restaurantId query parameter required"});
    return;
  }

  try {
    const restaurantDoc = await db.collection("restaurants").doc(restaurantId).get();
    if (!restaurantDoc.exists) {
      res.status(404).json({error: "Restaurant not found"});
      return;
    }

    await syncOpenTableReservationsForRestaurant({
      id: restaurantId,
      ...restaurantDoc.data(),
    });

    res.json({success: true, restaurantId});
  } catch (error) {
    console.error("Error in manual OpenTable sync:", error);
    res.status(500).json({error: error.message});
  }
});

// ============================================
// PUSH NOTIFICATION SERVICE
// ============================================

/**
 * Send push notification to user
 * Triggered by Firestore trigger when notification is created
 */
exports.sendPushNotification = functions.firestore
    .document("notifications/{notificationId}")
    .onCreate(async (snap, context) => {
      const notification = snap.data();
      const notificationId = context.params.notificationId;

      // Only send push for HIGH or MEDIUM priority notifications
      if (notification.priority !== "high" && notification.priority !== "medium") {
        console.log(`Skipping push notification ${notificationId} - priority is ${notification.priority}`);
        return null;
      }

      // Skip if already sent
      if (notification.pushSent) {
        console.log(`Push notification ${notificationId} already sent`);
        return null;
      }

      try {
        // Get user's FCM tokens
        const userRef = db.collection("users").doc(notification.userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists()) {
          console.log(`User ${notification.userId} not found`);
          return null;
        }

        const userData = userSnap.data();
        const fcmTokens = userData.fcmTokens || [];

        if (fcmTokens.length === 0) {
          console.log(`No FCM tokens for user ${notification.userId}`);
          // Mark as sent (no tokens available)
          await snap.ref.update({ pushSent: true });
          return null;
        }

        // Prepare notification payload
        const message = {
          notification: {
            title: notification.title,
            body: notification.message,
          },
          data: {
            notificationId,
            type: notification.type,
            actionUrl: notification.actionUrl || "",
            ...notification.metadata,
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "lineup_notifications",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                badge: 1,
              },
            },
          },
        };

        // Send to all user's devices
        const sendPromises = fcmTokens.map(async (token) => {
          try {
            await admin.messaging().send({
              ...message,
              token,
            });
            console.log(`Push notification sent to token ${token.substring(0, 20)}...`);
            return { token, success: true };
          } catch (error) {
            console.error(`Error sending push to token ${token.substring(0, 20)}...:`, error);
            // If token is invalid, remove it
            if (error.code === "messaging/invalid-registration-token" ||
                error.code === "messaging/registration-token-not-registered") {
              const updatedTokens = fcmTokens.filter((t) => t !== token);
              await userRef.update({ fcmTokens: updatedTokens });
            }
            return { token, success: false, error: error.message };
          }
        });

        const results = await Promise.allSettled(sendPromises);
        const successful = results.filter((r) => r.status === "fulfilled" && r.value.success).length;

        // Mark notification as sent
        await snap.ref.update({
          pushSent: true,
          pushSentAt: admin.firestore.FieldValue.serverTimestamp(),
          pushSentTo: successful,
        });

        console.log(`Push notification ${notificationId} sent to ${successful}/${fcmTokens.length} devices`);
        return { success: true, sentTo: successful, total: fcmTokens.length };
      } catch (error) {
        console.error(`Error sending push notification ${notificationId}:`, error);
        // Don't throw - we don't want to retry failed notifications
        return null;
      }
    });

// ============================================
// EMAIL NOTIFICATION SERVICE
// ============================================

/**
 * Send email notification
 * Triggered by Firestore trigger when notification is created
 */
exports.sendEmailNotification = functions.firestore
    .document("notifications/{notificationId}")
    .onCreate(async (snap, context) => {
      const notification = snap.data();
      const notificationId = context.params.notificationId;

      // Only send email for HIGH or MEDIUM priority notifications
      if (notification.priority !== "high" && notification.priority !== "medium") {
        console.log(`Skipping email notification ${notificationId} - priority is ${notification.priority}`);
        return null;
      }

      // Skip if already sent
      if (notification.emailSent) {
        console.log(`Email notification ${notificationId} already sent`);
        return null;
      }

      // Skip if no SendGrid API key configured
      if (!SENDGRID_API_KEY) {
        console.log("SendGrid API key not configured, skipping email");
        return null;
      }

      try {
        // Get user's email
        const userRef = db.collection("users").doc(notification.userId);
        const userSnap = await userRef.get();

        if (!userSnap.exists()) {
          console.log(`User ${notification.userId} not found`);
          return null;
        }

        const userData = userSnap.data();
        const userEmail = userData.email;

        if (!userEmail) {
          console.log(`No email for user ${notification.userId}`);
          // Mark as sent (no email available)
          await snap.ref.update({ emailSent: true });
          return null;
        }

        // Check user's email preferences (default to true)
        const emailPreferences = userData.emailPreferences || {};
        const notificationTypeEnabled = emailPreferences[notification.type] !== false;

        if (!notificationTypeEnabled) {
          console.log(`Email disabled for notification type ${notification.type} for user ${notification.userId}`);
          await snap.ref.update({ emailSent: true, emailSkipped: true });
          return null;
        }

        // Generate email content based on notification type
        const emailContent = generateEmailContent(notification);

        // Send email via SendGrid
        const msg = {
          to: userEmail,
          from: {
            email: functions.config().sendgrid?.from_email || "noreply@thelineup.app",
            name: functions.config().sendgrid?.from_name || "The Lineup",
          },
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        };

        await sgMail.send(msg);

        // Mark notification as sent
        await snap.ref.update({
          emailSent: true,
          emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        console.log(`Email notification ${notificationId} sent to ${userEmail}`);
        return { success: true, email: userEmail };
      } catch (error) {
        console.error(`Error sending email notification ${notificationId}:`, error);
        // Don't throw - we don't want to retry failed notifications
        return null;
      }
    });

/**
 * Generate email content based on notification type
 */
function generateEmailContent(notification) {
  const actionButton = notification.actionUrl
    ? `<a href="${notification.actionUrl}" style="display: inline-block; padding: 12px 24px; background: #4da3ff; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0;">View Details</a>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #4da3ff; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .footer { text-align: center; margin-top: 30px; color: #999; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>The Lineup</h1>
        </div>
        <div class="content">
          <h2>${notification.title}</h2>
          <p>${notification.message}</p>
          ${actionButton}
        </div>
        <div class="footer">
          <p>You're receiving this email because you have notifications enabled.</p>
          <p><a href="${process.env.REACT_APP_URL || "https://thelineup.app"}/profile-settings">Manage notification preferences</a></p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
The Lineup

${notification.title}

${notification.message}

${notification.actionUrl ? `View Details: ${notification.actionUrl}` : ""}

You're receiving this email because you have notifications enabled.
Manage notification preferences: ${process.env.REACT_APP_URL || "https://thelineup.app"}/profile-settings
  `;

  return {
    subject: notification.title,
    html,
    text,
  };
}

/**
 * HTTP endpoint to send email (for manual triggers)
 */
exports.sendEmail = functions.https.onRequest(async (req, res) => {
  // CORS handling
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  try {
    const { to, subject, html, text } = req.body;

    if (!to || !subject || !html) {
      res.status(400).json({ error: "Missing required fields: to, subject, html" });
      return;
    }

    if (!SENDGRID_API_KEY) {
      res.status(500).json({ error: "SendGrid API key not configured" });
      return;
    }

    const msg = {
      to,
      from: {
        email: functions.config().sendgrid?.from_email || "noreply@thelineup.app",
        name: functions.config().sendgrid?.from_name || "The Lineup",
      },
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    };

    await sgMail.send(msg);

    res.status(200).json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email:", error);
    res.status(500).json({ error: error.message });
  }
});

