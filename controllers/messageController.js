const Message = require("../models/messageModel");
const generateUniqueId = require("../utils/generateUniqueId");
const path = require("path");
const fs = require("fs");
const mime = require("mime-types"); // Add this at the top of your file

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

    console.log(req.body,"sa")
    const { receiverId } = req.body;

    // Fetch messages by receiverId
    const messages = await Message.find({ receiverId }).sort({ timestamp: -1 });
    console.log(messages,"mess")

    if (messages.length === 0) {
      return res
        .status(404)
        .json({ message: "No messages found for the given receiverId." });
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

    console.log(
      id,
      chatId,
      senderId,
      receiverId,
      fileName,
      fileType,
      "newwwwww"
    );

    // Get the absolute path to the file
    const filePath = path.resolve(
      __dirname,
      "..",
      "uploads",
      fileType + "s",
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
        res.status(500).json({ error: "Failed to download file." });
      }
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    res.status(500).json({ error: "Failed to download file." });
  }
};
