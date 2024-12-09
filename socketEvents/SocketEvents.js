const {
  getUserSocketId,
  setUserSocketId,
  getUndeliveredMessages,
  deleteUndeliveredMessages,
  notifyUndeliveredMessages,
  getUndeliveredMessageStatus,
  setUndeliveredMessageStatus,
  deleteUndeliveredMessageStatus,
  addSenderToList,
  removeSenderFromList,
  getUserIdfomSocketId,
  deleteUserSocketId,
  getUserIdFromSocketId,
} = require("../redis/redis");
const fs = require("fs");
const path = require("path");
const Message = require("../models/messageModel");
const FileMetadata = require("../models/FileMetaDataModel");
const DeletedMessage = require("../models/DeleteMessageModel");
const User = require("../models/usersModel");
const sendNotification = require("../utils/Notification");

const handleRegister = async (socket, io, { userId }) => {
  try {
    await setUserSocketId(userId, socket.id);
    io.emit("user-connected", { userId });

    const messageSenders = await notifyUndeliveredMessages(userId);
    if (messageSenders.length > 0) {
      for (const senderId of messageSenders) {
        const senderSocketId = await getUserSocketId(senderId);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messageNotification", {
            senderId,
            receiverId: userId,
            status: "undelivered",
          });
        }
      }
    }

    const undeliveredMessageStatus = await getUndeliveredMessageStatus(userId);
    if (undeliveredMessageStatus.length > 0) {
      // io.to(socket.id).emit("receiveMessage", undeliveredMessageStatus);
      // await deleteUndeliveredMessageStatus(userId);
    }
  } catch (err) {
    console.error("Error in register event:", err);
  }
};

// Define other handlers similarly...

const handleBatchMessageStatusUpdate = async (io, statusUpdates) => {
  try {
    const userUpdatesMap = {};

    for (const update of statusUpdates) {
      const { acknowledgeTo } = update;
      if (!userUpdatesMap[acknowledgeTo]) {
        userUpdatesMap[acknowledgeTo] = [];
      }
      userUpdatesMap[acknowledgeTo].push(update);
    }

    for (const [userId, updates] of Object.entries(userUpdatesMap)) {
      const receiverSocketId = await getUserSocketId(userId);

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("receiveBatchMessageStatus", updates);
      } else {
        const undeliveredMessageStatus = await getUndeliveredMessageStatus(
          userId
        );
        undeliveredMessageStatus.push(...updates);
        await setUndeliveredMessageStatus(userId, undeliveredMessageStatus);
      }
    }
  } catch (err) {
    console.error("Error handling batch message status update:", err);
  }
};

const handleSendMessage = async (io, msg) => {
  const { id, senderId, receiverId } = msg;

  try {
    const receiver = await User.findOne({ phone_number: receiverId });
    // Retrieve device token from the receiver
    const deviceToken = receiver.deviceToken;
    console.log("Receiver's Device Token:", deviceToken);

    const receiverSocketId = await getUserSocketId(receiverId);
    if (receiverSocketId) {
      console.log("message receievd");
      io.to(receiverSocketId).emit("receiveMessage", msg);
      console.log("message sent.....");
      // const newMessage = new Message(msg);
      // await newMessage.save();
    } else {
      const newMessage = new Message(msg);
      await newMessage.save();
      const result = await sendNotification(
        deviceToken,
        senderId,
        msg.content,
        msg
      );
      if (result) {
        console.log("Notification sent successfully.");
      } else {
        console.log("Notification failed but continuing...");
      }
    }
  } catch (err) {
    console.error("Error in sendMessage event:", err);
  }
};

const handleResendMessage = async (io, msg) => {
  const { senderId, receiverId } = msg;
  try {
    await removeSenderFromList(receiverId, senderId);
    const receiverSocketId = await getUserSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveMessage", msg);
      const newMessage = new Message(msg);
      await newMessage.save();
    }
  } catch (err) {
    console.error("Error in resendMessage event:", err);
  }
};

// Define other handlers similarly...

const handleMessageAcknowledge = async (io, msg) => {
  const receiverSocketId = await getUserSocketId(msg.acknowledgeTo);
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("messageAcknowledgementStatus", msg);
  } else {
    await createMessageAcknowledgement(
      msg.message_id,
      msg.acknowledgeTo,
      msg.acknowledgeFrom,
      msg.status
    );
  }
};

const handleSendFileChunk = async (io, msg) => {
  const receiverSocketId = await getUserSocketId(msg.receiverId);
  io.to(receiverSocketId).emit("receiveFileChunk", msg);
};

const handleFileTransferComplete = async (io, msg) => {
  const receiverSocketId = await getUserSocketId(msg.receiverId);
  io.to(receiverSocketId).emit("fileTransferComplete", msg);
};

const handleForwardMessage = async (
  socket,
  { originalMessageId, receiverId }
) => {
  try {
    const originalMessage = await getUndeliveredMessages(originalMessageId);
    if (originalMessage) {
      const forwardedMessage = { ...originalMessage, forwarded: true };
      socket.emit("sendMessage", { ...forwardedMessage, receiverId });
    }
  } catch (err) {
    console.error("Error in forwardMessage event:", err);
  }
};

const handleReactToMessage = ({ messageId, reaction }) => {
  io.emit("messageReacted", { messageId, reaction });
};

const handleDeleteMessage = ({ messageId, userId }) => {
  io.emit("messageDeleted", { messageId, userId });
};

const handleEditMessage = ({ messageId, newContent }) => {
  io.emit("messageEdited", { messageId, newContent });
};

const handleUploadMedia = async ({ senderId, receiverId, media }) => {
  try {
    const message = { senderId, receiverId, attachments: [media] };
    socket.emit("sendMessage", message);
  } catch (err) {
    console.error("Error in uploadMedia event:", err);
  }
};

const handleSetTimer = ({ messageId, duration }) => {
  setTimeout(() => {
    io.emit("deleteMessage", { messageId });
  }, duration);
};

const handleJoinRoom = (socket, roomId) => {
  socket.join(roomId);
  socket.to(roomId).emit("user-connected", socket.id);
};

const handleCheckUserStatus = async (socket, userId, chatId) => {
  try {
    console.log(userId, "as");

    // const userSocketId = await getUserSocketId(userId);
    const friendSocketId = await getUserSocketId(chatId);
    const status = friendSocketId ? "online" : "offline";
    socket.emit("checkUserStatus", { chatId, status });
  } catch (err) {
    console.error("Error in checkUserStatus event:", err);
  }
};

const handleCallInitiation = async ({ callerId, receiverId }) => {
  try {
    const receiverSocketId = await getUserSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("call-invitation", { callerId });
    }
  } catch (err) {
    console.error("Error in call-initiation event:", err);
  }
};

const handleCallAccepted = async ({ chatId }) => {
  try {
    const receiverSocketId = await getUserSocketId(chatId);
    io.to(receiverSocketId).emit("user-connected_to_call");
  } catch (err) {
    console.error("Error in call-accepted event:", err);
  }
};

const handleOffer = async (socket, offer, chatId) => {
  try {
    const receiverSocketId = await getUserSocketId(chatId);
    if (receiverSocketId) {
      socket.to(receiverSocketId).emit("offer", offer, socket.id);
    }
  } catch (err) {
    console.error("Error in offer event:", err);
  }
};

const handleAnswer = async (answer, chatId) => {
  try {
    const receiverSocketId = await getUserSocketId(chatId);
    if (receiverSocketId) {
      socket.to(receiverSocketId).emit("answer", answer, socket.id);
    }
  } catch (err) {
    console.error("Error in answer event:", err);
  }
};

const handleIceCandidate = async (socket, candidate, chatId) => {
  try {
    const receiverSocketId = await getUserSocketId(chatId);
    if (receiverSocketId) {
      socket.to(receiverSocketId).emit("ice-candidate", candidate, socket.id);
    }
  } catch (err) {
    console.error("Error in ice-candidate event:", err);
  }
};

const handleEndCall = async (chatId) => {
  try {
    const receiverSocketId = await getUserSocketId(chatId);
    if (receiverSocketId) {
      socket.to(receiverSocketId).emit("end-call");
    }
  } catch (err) {
    console.error("Error in end-call event:", err);
  }
};

const handleDisconnect = async (io, socket) => {
  try {
    console.log("A user disconnected:", socket.id, socket.user);
    const user = await getUserIdFromSocketId(socket.id);
    await deleteUserSocketId(user);
    io.emit("user-disconnected", { userId: user });
  } catch (err) {
    console.error("Error in disconnect event:", err);
  }
};

// Helper function to ensure directory exists
// Helper function to ensure directory exists
const chunkStorage = {};

// Handle receiving and saving the thumbnail
const handleThumbnail = async (io, socket, message) => {
  const {
    messageId,
    chunk,
    chunkNumber,
    uniqueFileName,
    fileType,
    msg,
    encryptedAESKey,
  } = message;

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

const handleTypingStatus = async (io, socket, message) => {
  const { chatId, userId, status } = message;

  const receiverSocketId = await getUserSocketId(chatId);

  if (receiverSocketId) {
    io.to(receiverSocketId).emit("typingStatusRecieve", message);
    console.log("Message sent to receiver.");
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
    encryptedAESKey,
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
      msg.aesKey = encryptedAESKey;

      // Notify the receiver about the new message
      const receiverSocketId = await getUserSocketId(receiverId);
      console.log(`Receiver socket ID: ${receiverSocketId}`);

      const receiver = await User.findOne({ phone_number: receiverId });
      // Retrieve device token from the receiver
      const deviceToken = receiver.deviceToken;
      console.log("Receiver's Device Token:", deviceToken);
      await sendNotification(deviceToken, senderId, "Recieved a media file");

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

// Ensure directory exists
const ensureDirectoryExists = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const handleDeleteMessageonBothSides = async (io, socket, msg) => {
  console.log(msg, "sd");
  const { id, senderId, receiverId, messageId } = msg;

  const receiverSocketId = await getUserSocketId(receiverId);
  if (receiverSocketId) {
    socket.to(receiverSocketId).emit("DeleteMessageOnBothSides", msg);
  } else {
    console.log("Sender ID:", senderId);
    console.log("Receiver ID:", receiverId); // Check if this is populated
    console.log("Message ID:", messageId);
    const deletedMessage = new DeletedMessage({
      id,
      senderId,
      receiverId,
      messageId,
    });

    // Save the deleted message to the database
    await deletedMessage.save();
  }
};

module.exports = {
  handleRegister,
  handleBatchMessageStatusUpdate,
  handleSendMessage,
  handleResendMessage,
  handleMessageAcknowledge,
  handleSendFileChunk,
  handleFileTransferComplete,
  handleForwardMessage,
  handleReactToMessage,
  handleDeleteMessage,
  handleEditMessage,
  handleUploadMedia,
  handleSetTimer,
  handleJoinRoom,
  handleCheckUserStatus,
  handleCallInitiation,
  handleCallAccepted,
  handleOffer,
  handleAnswer,
  handleIceCandidate,
  handleEndCall,
  handleDisconnect,
  handleReceiveFileChunk,
  handleThumbnail,
  handleDeleteMessageonBothSides,
  handleTypingStatus,
};
