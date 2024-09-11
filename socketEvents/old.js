// Helper function to ensure directory exists
const chunkStorage = {};

// Function to handle thumbnail processing
const handleThumbnail = async (io, socket, message) => {
  const { messageId, chunk, chunkNumber, uniqueFileName, fileType, msg } =
    message;

  try {
    if (fileType === "thumbnail" && chunkNumber === 0) {
      const thumbnailUploadPath = path.join(
        __dirname,
        "..",
        "uploads",
        "thumbnails",
        uniqueFileName
      );
      ensureDirectoryExists(path.dirname(thumbnailUploadPath));
      fs.writeFileSync(thumbnailUploadPath, Buffer.from(chunk, "base64"));
      console.log("Thumbnail saved successfully.");

      // Save thumbnail metadata
      let msgobj = {
        msg_id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        fileName: uniqueFileName,
        fileType: fileType,
        downloadStatus: false,
        expirationDate: new Date(new Date().setDate(new Date().getDate() + 10)),
      };

      const fileMetaData = new FileMetadata(msgobj);
      await fileMetaData.save();
      console.log("Thumbnail metadata saved.");

      // Emit acknowledgment for the thumbnail
      socket.emit("fileChunkAck", { messageId, chunkNumber });
    }
  } catch (err) {
    console.error("Error handling thumbnail:", err);
  }
};

// Function to handle main file processing
const handleReceiveFileChunk = async (io, socket, message) => {
  const {
    messageId,
    chunk,
    chunkNumber,
    totalChunks,
    uniqueFileName,
    fileType,
    senderId,
    receiverId,
    msg,
  } = message;

  try {
    // Initialize chunk storage for the message if it doesn't exist
    console.log(message, "recievd");
    if (!chunkStorage[messageId]) {
      chunkStorage[messageId] = {
        chunks: [],
        totalChunks,
        fileType,
        senderId,
        receiverId,
        uniqueFileName,
      };
    }

    // Add the received chunk to storage
    chunkStorage[messageId].chunks[chunkNumber] = chunk;

    // Emit acknowledgment for the received chunk
    socket.emit("fileChunkAck", { messageId, chunkNumber });

    // Check if all chunks have been received
    if (chunkStorage[messageId].chunks.length === totalChunks) {
      console.log("Assembling file...");

      const fileData = Buffer.concat(
        chunkStorage[messageId].chunks.map((chunk) =>
          Buffer.from(chunk, "base64")
        )
      );

      // Determine the file type and directory
      let directory;
      switch (fileType) {
        case "image":
          directory = "images";
          break;
        case "document":
          directory = "documents";
          break;
        case "video":
          directory = "videos";
          break;
        default:
          throw new Error("Unsupported file type");
      }

      // Define file paths
      const fileUploadPath = path.join(
        __dirname,
        "..",
        "uploads",
        directory,
        uniqueFileName
      );

      ensureDirectoryExists(path.dirname(fileUploadPath));
      fs.writeFileSync(fileUploadPath, fileData);
      console.log(`File saved to ${fileUploadPath}`);

      // Clean up chunk storage
      delete chunkStorage[messageId];

      // Save file metadata
      let msgobj = {
        msg_id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        fileName: uniqueFileName,
        fileType: fileType,
        downloadStatus: false,
        expirationDate: new Date(new Date().setDate(new Date().getDate() + 10)),
      };

      const fileMetaData = new FileMetadata(msgobj);
      await fileMetaData.save();
      console.log("File metadata saved.");

      // Prepare message for receiver
      msg.isThumbnailDownloaded = 0;
      msg.isOriginalAttachmentDownloaded = 0;

      // Notify the receiver about the new message
      const receiverSocketId = await getUserSocketId(receiverId);
      console.log(`Receiver socket ID: ${receiverSocketId}`);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receiveMessage", msg);
        console.log("Message sent to receiver");
      } else {
        console.log("Saving message to database.");
        const newMessage = new Message(msg);
        await newMessage.save();
        console.log("Message saved to database.");
      }
    }
  } catch (err) {
    console.error("Error handling file chunk:", err);
  }
};

// Ensure directory exists
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};