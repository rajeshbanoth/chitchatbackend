// Helper function to ensure directory exists
const chunkStorage = {};

// Handle receiving and saving the thumbnail
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

      // Save thumbnail chunk to disk
      fs.writeFileSync(thumbnailUploadPath, Buffer.from(chunk, "base64"));
      console.log("Thumbnail saved successfully.");

      // Save thumbnail metadata to the database
      const msgObj = {
        msg_id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        fileName: uniqueFileName,
        fileType: fileType,
        downloadStatus: false,
        expirationDate: new Date(new Date().setDate(new Date().getDate() + 10)),
      };

      const fileMetaData = new FileMetadata(msgObj);
      await fileMetaData.save();
      console.log("Thumbnail metadata saved.");

      // Acknowledge successful reception of the thumbnail
      socket.emit("fileChunkAck", { messageId, chunkNumber });
    }
  } catch (err) {
    console.error("Error handling thumbnail:", err);
  }
};

// Handle receiving and saving the main file in chunks
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

  console.log(fileType, "fileType");
  try {
    // Initialize chunk storage for the message if it doesn't exist
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

    // Save the received chunk to disk (use temp folder to store chunks)
    const tempChunkPath = path.join(__dirname, "..", "temp", messageId);
    ensureDirectoryExists(tempChunkPath);
    const chunkFilePath = path.join(tempChunkPath, `chunk_${chunkNumber}`);
    fs.writeFileSync(chunkFilePath, Buffer.from(chunk, "base64"));
    console.log(
      `Chunk ${chunkNumber} of ${totalChunks} received for message: ${messageId}`
    );

    // Acknowledge the received chunk
    socket.emit("fileChunkAck", { messageId, chunkNumber });

    // Check if all chunks have been received
    const receivedChunkFiles = fs.readdirSync(tempChunkPath);
    if (receivedChunkFiles.length === totalChunks) {
      console.log("All chunks received, assembling the file...");

      // Assemble file from chunks
      const chunks = receivedChunkFiles
        .sort() // Ensure correct order of chunks
        .map((chunkFile) =>
          fs.readFileSync(path.join(tempChunkPath, chunkFile))
        );
      const fileData = Buffer.concat(chunks);

      // Determine file directory based on file type
      let directory;
      switch (fileType) {
        case "Image":
          directory = "images";
          break;
        case "Document":
          directory = "documents";
          break;
        case "Video":
          directory = "videos";
          break;
        default:
          throw new Error("Unsupported file type");
      }

      // Define file upload path
      const fileUploadPath = path.join(
        __dirname,
        "..",
        "uploads",
        directory,
        uniqueFileName
      );
      ensureDirectoryExists(path.dirname(fileUploadPath));

      // Save the assembled file to disk
      fs.writeFileSync(fileUploadPath, fileData);
      console.log(`File saved to ${fileUploadPath}`);

      // Clean up temporary chunk files
      fs.rmdirSync(tempChunkPath, { recursive: true });

      // Save file metadata to the database
      const msgObj = {
        msg_id: msg.id,
        chatId: msg.chatId,
        senderId: msg.senderId,
        receiverId: msg.receiverId,
        fileName: uniqueFileName,
        fileType: fileType,
        downloadStatus: false,
        expirationDate: new Date(new Date().setDate(new Date().getDate() + 10)),
      };

      const fileMetaData = new FileMetadata(msgObj);
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
        console.log("Message sent to receiver.");
      } else {
        // Save message to the database if the receiver is not online
        const newMessage = new Message(msg);
        await newMessage.save();
        console.log("Message saved to the database.");
      }
    }
  } catch (err) {
    console.error("Error handling file chunk:", err);
  }
};