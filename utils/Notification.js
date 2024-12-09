const admin = require("firebase-admin");
const serviceAccount = require("../config/chitchat-16e2c-001c4ed46d03"); // Path to your Firebase service account JSON

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// This function sends a notification to a specific device using its FCM token
async function sendNotification(fcmToken, title, body, msg) {
  const message = {
    token: fcmToken, // FCM Token of the target device
    notification: {
      title: title, // Title of the notification
      body: body,   // Body of the notification
    },
    data: {
      chatId: title,
      msg: JSON.stringify(msg), // Add custom data as needed
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
    return response; // Return response if needed
  } catch (error) {
    console.error("Error sending message:", error);
    return null; // Ensure the program doesn't stop and moves to the next task
  }
}

module.exports = sendNotification;
