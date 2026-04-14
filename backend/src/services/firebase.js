const admin = require('firebase-admin');
const config = require('../config');
const db = require('../config/database');

let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized || !config.firebase.projectId) {
    return;
  }

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.firebase.projectId,
      privateKey: config.firebase.privateKey,
      clientEmail: config.firebase.clientEmail,
    }),
  });

  firebaseInitialized = true;
  console.log('Firebase Admin initialized');
}

async function sendPushNotification(userId, title, body, data = {}) {
  if (!firebaseInitialized) return;

  try {
    const result = await db.query(
      'SELECT fcm_token FROM admin_users WHERE id = $1 AND fcm_token IS NOT NULL',
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].fcm_token) return;

    await admin.messaging().send({
      token: result.rows[0].fcm_token,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { sound: 'default', channelId: 'orders' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
  } catch (err) {
    console.error('Push notification failed:', err.message);
  }
}

async function sendToRestaurantAdmins(restaurantId, title, body, data = {}) {
  if (!firebaseInitialized) return;

  try {
    const result = await db.query(
      'SELECT fcm_token FROM admin_users WHERE restaurant_id = $1 AND fcm_token IS NOT NULL AND is_active = 1',
      [restaurantId]
    );

    const tokens = result.rows.map((r) => r.fcm_token).filter(Boolean);
    if (tokens.length === 0) return;

    await admin.messaging().sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
    });
  } catch (err) {
    console.error('Multi push notification failed:', err.message);
  }
}

async function updateFcmToken(userId, fcmToken) {
  await db.query('UPDATE admin_users SET fcm_token = $1 WHERE id = $2', [fcmToken, userId]);
}

module.exports = {
  initializeFirebase,
  sendPushNotification,
  sendToRestaurantAdmins,
  updateFcmToken,
};
