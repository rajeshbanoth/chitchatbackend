const Message = require("../models/messageModel");
const generateUniqueId = require("../utils/generateUniqueId");
const DeletedMessage = require("../models/DeleteMessageModel");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types"); // Add this at the top of your file
const sendNotification = require("../utils/Notification");

exports.createMessage = async (req, res) => {
  try {
    const {
      chatId,
      senderId,
      receiverId,
      content,
      attachments,
      messageType,
      timestamp,
    } = req.body;

    const message = new Message({
      id: generateUniqueId(), // Implement a function to generate unique IDs
      chatId,
      senderId,
      receiverId,
      content,
      attachments,
      messageType,
      timestamp: timestamp || Date.now(),
    });

    await Message.save();

    return res
      .status(201)
      .json({ message: "Message created successfully.", data: message });
  } catch (error) {
    console.error("Error creating message:", error);
    return res.status(500).json({ error: "Failed to create message." });
  }
};

exports.getAndDeleteMessagesByReceiverId = async (req, res) => {
  try {
 
    const { receiverId } = req.body;

    // Fetch messages by receiverId
    const messages = await Message.find({ receiverId }).sort({ timestamp: -1 });
    console.log(messages, "mess");

    if (messages.length === 0) {
      return res
        .status(404)
        .json({ message: "No messages found for the given receiverId." });
    }

        // Send individual notifications for each message
        for (const message of messages) {
          
          const receiver = await User.findOne({ phone_number:  message.receiverId });
          // Retrieve device token from the receiver
          const deviceToken = receiver.deviceToken;
          console.log("Receiver's Device Token:", deviceToken);
      
          await sendNotification(deviceToken, message.content, message.senderId);
        }

    // Delete the fetched messages
    await Message.deleteMany({ receiverId });
    return res.status(200).json({
      message: "Messages retrieved and deleted successfully.",
      data: messages,
    });
  } catch (error) {
    console.error("Error fetching and deleting messages:", error);
    return res
      .status(500)
      .json({ error: "Failed to fetch and delete messages." });
  }
};

exports.downloadMedia = async (req, res) => {
  try {
    const { id, chatId, senderId, receiverId, fileName, fileType } = req.body;

    console.log(id, chatId, senderId, receiverId, fileName, fileType, "newwwwww");

    // Get the absolute path to the file
    const filePath = path.resolve(
      __dirname,
      "..",
      "uploads",
      fileType + "s", // e.g., images, videos
      fileName
    );

    // Check if the file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "File not found." });
    }

    // Set the MIME type based on file type
    const mimeType = mime.lookup(filePath) || "application/octet-stream";
    res.setHeader("Content-Type", mimeType);

    // Send the file to the client
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error("Error sending file:", err);
        return res.status(500).json({ error: "Failed to download file." });
      }
    });

    // Event listener for successful response finish (whole file sent)
    res.on("finish", async () => {
      try {
        // Delete the file after it has been fully sent
        await fs.promises.unlink(filePath);
        console.log("File deleted:", filePath);
      } catch (deleteErr) {
        console.error("Error deleting file:", deleteErr);
      }
    });

  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ error: "Failed to download file." });
  }
};

// exports.downloadMedia = async (req, res) => {
//   try {
//     const { id, chatId, senderId, receiverId, fileName, fileType } = req.body;

//     console.log(
//       id,
//       chatId,
//       senderId,
//       receiverId,
//       fileName,
//       fileType,
//       "newwwwww"
//     );

//     // Get the absolute path to the file
//     const filePath = path.resolve(
//       __dirname,
//       "..",
//       "uploads",
//       fileType + "s",
//       fileName
//     );
//     // Check if the file exists
//     if (!fs.existsSync(filePath)) {
//       return res.status(404).json({ error: "File not found." });
//     }

//     // Set the MIME type based on file type
//     const mimeType = mime.lookup(filePath) || "application/octet-stream";
//     res.setHeader("Content-Type", mimeType);

//     // Send the file to the client
//     res.sendFile(filePath, (err) => {
//       if (err) {
//         console.error("Error sending file:", err);
//         res.status(500).json({ error: "Failed to download file." });
//       }
//     });
//   } catch (error) {
//     console.error("Error downloading file:", error);
//     res.status(500).json({ error: "Failed to download file." });
//   }
// };

// Function to save a deleted message
exports.createDeletedMessage = async (req, res) => {
  try {
    const { senderId, receiverId, messageId } = req.body;
    // Create a new deleted message
    const deletedMessage = new DeletedMessage({
      senderId,
      receiverId,
      messageId,
    });
    // Save the deleted message to the database
    await deletedMessage.save();

    return res.status(201).json({
      message: "Deleted message recorded successfully.",
      data: deletedMessage,
    });
  } catch (error) {
    console.error("Error creating deleted message:", error);
    return res.status(500).json({ error: "Failed to record deleted message." });
  }
};

// Function to get deleted messages by receiverId
// Assuming you have a controller file `deletedMessageController.js`
exports.getDeletedMessagesByReceiverId = async (req, res) => {
  try {
    console.log(req.body, "aspdoasdo");
    const { receiverId } = req.body;

    // Fetch deleted messages where receiverId matches the provided ID
    const deletedMessages = await DeletedMessage.find({ receiverId });

    if (!deletedMessages.length) {
      return res.status(404).json({ message: "No deleted messages found." });
    }

    return res.status(200).json({
      message: "Deleted messages retrieved successfully.",
      data: deletedMessages,
    });
  } catch (error) {
    console.error("Error retrieving deleted messages:", error);
    return res
      .status(500)
      .json({ error: "Failed to retrieve deleted messages." });
  }
};

// Function to delete a deleted message by id
exports.deleteDeletedMessageById = async (req, res) => {
  try {
    const { id } = req.body;

    console.log(req.body,"id")

    // Find and delete the deleted message by id
    const deletedMessage = await DeletedMessage.findOneAndDelete(id);

    if (!deletedMessage) {
      return res.status(404).json({ message: "Deleted message not found." });
    }

    return res.status(200).json({
      message: "Deleted message successfully deleted.",
      data: deletedMessage,
    });
  } catch (error) {
    console.error("Error deleting deleted message:", error);
    return res.status(500).json({ error: "Failed to delete deleted message." });
  }
};
