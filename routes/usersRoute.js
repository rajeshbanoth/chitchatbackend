const express = require("express");
const router = express.Router();
const userController = require("../controllers/UsersController");
const messageController = require("../controllers/messageController");
const { authenticate } = require("../middlewares/auth");
const upload = require("../middlewares/multer");
const path = require("path");
const User = require("../models/usersModel");

const fs = require("fs");
const {
  blockUser,
  unblockUser,
} = require("../controllers/BlockUserController");

const uploadDirectory = path.join(__dirname, "..", "uploads"); // Adjust path if needed

router.post("/user/auth/send-otp", userController.sendOtp);
router.post("/user/auth/verify-otp", userController.verifyOtp);
router.post("/user/profile", userController.getUserProfile);
// router.put("/user/profile", authenticate, userController.updateUserProfile);
router.post("/user/logout", authenticate, userController.logoutUser);
router.post("/user/checkContacts", userController.checkContacts);
router.post("/user/publicKey", userController.getPublicKeyByPhoneNumber);
router.post(
  "/user/profile/deleteProfilepic",
  userController.deleteProfilePicture
);
router.delete("/user/account/delete/:userId", userController.deleteUserAccount);
router.post("/user/chat/block", blockUser);
router.post("/user/chat/unblock", unblockUser);

// Endpoint to get updated contacts
// router.get('/get-updated-contacts', async (req, res) => {
//   const lastSyncTimestamp = req.headers['last-sync-timestamp'];

//   // Query to get all users who have been updated after the last sync timestamp
//   const updatedUsers = await User.find({
//     last_updated: { $gt: new Date(lastSyncTimestamp) }
//   });

//   res.json(updatedUsers);
// });

router.get("/user/get-updated-contacts", userController.getUpdatedContacts);

router.post(
  "/user/updateProfilePictureAndBio",
  // userController.removeImage,
  // upload.single("profilePicture"), // Use multer to handle single file upload with field name 'profilePicture'
  userController.updateProfilePictureAndBio
);

router.post("/download/media", messageController.downloadMedia);
// Route to serve profile images
// router.get("/profile/image/:filename", (req, res) => {
//   const { filename } = req.params;
//   console.log(filename,"filename")
//   const filePath = path.join(uploadDirectory, filename);

//   // Send the file if it exists
//   res.sendFile(filePath, (err) => {
//     if (err) {
//       console.error("Error fetching image:", err);
//       // Ensure no further headers are sent after this point
//       if (!res.headersSent) {
//         res.status(404).json({ error: "Image not found" });
//       }
//     }
//   });
// });

// router.get("/profile/image/:filename", async (req, res) => {
//   try {
//     const { filename } = req.params;
//     console.log(req.params, "paramsss");
//     console.log(`Received request for image: ${filename}`);

//     // Validate the filename format: +<country_code><phone_number>_<timestamp>.<extension>
//     const filenamePattern = /^\+\d{1,4}\d{7,15}_\d+\.[a-zA-Z0-9]+$/; // E.g., +918897540734_1696543200.jpg
//     if (!filenamePattern.test(filename)) {
//       console.warn(`Invalid filename format: ${filename}`);
//       return res.status(400).json({ error: "Invalid filename format." });
//     }

//     // Extract phone number and timestamp from the filename (splitting based on _)
//     const [phone_number, timestampWithExtension] = filename.split("_");
//     const fileExtension = path.extname(filename);
//     const timestamp = timestampWithExtension.replace(fileExtension, ""); // Remove the extension from timestamp

//     // Ensure the user exists based on phone number
//     const user = await User.findOne({ phone_number });
//     if (!user) {
//       console.error(`User not found with phone number: ${phone_number}`);
//       return res.status(404).json({ error: "User not found." });
//     }

//     // Validate and compare the timestamp
//     const parsedTimestamp = Number(timestamp); // Convert the timestamp to a number
//     if (isNaN(parsedTimestamp)) {
//       console.warn(`Invalid timestamp format in filename: ${filename}`);
//       return res.status(400).json({ error: "Invalid image timestamp format." });
//     }

//     if (parsedTimestamp !== user.last_profile_picture_updated.getTime()) {
//       console.warn(`Timestamp mismatch for user: ${phone_number}`);
//       return res.status(400).json({ error: "Invalid image timestamp." });
//     }

//     // Construct the file path based on the validated filename
//     const filePath = path.join(uploadDirectory, filename);

//     // Check if the file exists
//     if (!fs.existsSync(filePath)) {
//       console.error(`Image not found: ${filePath}`);
//       return res.status(404).json({ error: "Image not found." });
//     }

//     // Log that the image will be sent
//     console.log(`Sending image: ${filePath}`);

//     // Set caching headers for optimal performance
//     res.set({
//       "Cache-Control": "public, max-age=31536000, immutable", // Caching for 1 year
//     });

//     // Send the image file
//     res.sendFile(filePath, (err) => {
//       if (err) {
//         console.error("Error sending image:", err);
//         if (!res.headersSent) {
//           res.status(500).json({ error: "Error serving the image." });
//         }
//       } else {
//         console.log(`Successfully sent image: ${filename}`);
//       }

//     });
//   } catch (error) {
//     // Log any unexpected errors
//     console.error("Error fetching image:", error);
//     res.status(500).json({ error: "Failed to fetch image." });
//   }
// });

router.get("/profile/image/:filename", userController.getProfileImage);

router.post(
  "/user/get/messages/id",
  messageController.getAndDeleteMessagesByReceiverId
);
module.exports = router;
