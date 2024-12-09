const express = require("express");
const router = express.Router();
const deletedMessageController = require("../controllers/messageController");

// Route to create a deleted message
// router.post(
//   "message/deleted-messages",
//   deletedMessageController.createDeletedMessage
// );

// Route to get deleted messages by receiverId
router.post(
  "/message/deleted-messages",
  deletedMessageController.getDeletedMessagesByReceiverId
);

// Route to delete a deleted message by id
router.post(
  "/message/delete/deleted-messages",
  deletedMessageController.deleteDeletedMessageById
);

router.post("/message/acknowledgements",deletedMessageController.getAcknowledgementsAndDelete)

module.exports = router;
