const express = require("express");
const router = express.Router();
const userController = require("../controllers/UsersController");
const messageController = require("../controllers/messageController");
const { authenticate } = require("../middlewares/auth");
const upload = require("../middlewares/multer");
const path = require("path");

const uploadDirectory = path.join(__dirname, "..", "uploads"); // Adjust path if needed

router.post("/user/auth/send-otp", userController.sendOtp);
router.post("/user/auth/verify-otp", userController.verifyOtp);
router.post("/user/profile", userController.getUserProfile);
router.put("/user/profile", authenticate, userController.updateUserProfile);
router.post("/user/logout", authenticate, userController.logoutUser);
router.post("/user/checkContacts", userController.checkContacts);
router.post("/user/publicKey", userController.getPublicKeyByPhoneNumber);

router.post(
  "/user/updateProfilePictureAndBio",
  // userController.removeImage,
  // upload.single("profilePicture"), // Use multer to handle single file upload with field name 'profilePicture'
  userController.updateProfilePictureAndBio
);

router.post("/download/media",messageController.downloadMedia)
// Route to serve profile images
router.get("/profile/image/:filename", (req, res) => {
  const { filename } = req.params;
  console.log(filename,"filename")
  const filePath = path.join(uploadDirectory, filename);

  // Send the file if it exists
  res.sendFile(filePath, (err) => {
    if (err) {
      console.error("Error fetching image:", err);
      // Ensure no further headers are sent after this point
      if (!res.headersSent) {
        res.status(404).json({ error: "Image not found" });
      }
    }
  });
});


router.post("/user/get/messages/id",messageController.getAndDeleteMessagesByReceiverId)
module.exports = router;


