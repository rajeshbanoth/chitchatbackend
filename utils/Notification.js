const admin = require("firebase-admin");
const serviceAccount = require("../config/chitchat-16e2c-b6a395a0e025"); // Path to your Firebase service account JSON

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// This function sends a notification to a specific device using its FCM token
async function sendNotification(fcmToken, title, body, msg) {
  const message = {
    token: fcmToken, // FCM Token of the target device
    notification: {
      title: title, // Title of the notification
      body: body, // Body of the notification
    },
    data: {
      // You can add additional custom data here
      //   customKey1: 'customValue1',
      //   customKey2: 'customValue2',

      chatId: title,
      msg: JSON.stringify(msg),
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log("Successfully sent message:", response);
  } catch (error) {
    console.error("Error sending message:", error);
  }
}

module.exports = sendNotification;
