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


const blockedUserCache = new Map();

// Helper function to check if users are blocked
const isBlocked = async (userId, chatId) => {
  // Check if the blocked status for this pair exists in cache
  const cacheKey = `${userId}-${chatId}`;
  if (blockedUserCache.has(cacheKey)) {
    return blockedUserCache.get(cacheKey);
  }

  // If not in cache, fetch from the database
  const user = await User.findOne({ phone_number: userId });
  const friend = await User.findOne({ phone_number: chatId });

  if (!user || !friend) {
    console.error('User or friend not found');
    return false; // Default case if users not found in DB
  }

  const isBlockedByUser = user.blocked_users.some(blocked => blocked.user_id === chatId);
  const isBlockedByFriend = friend.blocked_users.some(blocked => blocked.user_id === userId);

  const blocked = isBlockedByUser || isBlockedByFriend;

  // Cache the result for future use
  blockedUserCache.set(cacheKey, blocked);

  return blocked;
};


const handleRegister = async (socket, io, { userId }) => {
  try {
    // Set user socket ID for tracking using userId (which is the phone number)
    await setUserSocketId(userId, socket.id);

    // Get the user's details using userId (which is the phone number)
    const user = await User.findOne({ phone_number: userId }); // Find user by phone_number (which is userId)
    if (!user) {
      console.error('User not found');
      return;
    }

    // Get the user's friends' phone numbers (assuming friends are stored by phone numbers)
    const friendsPhoneNumbers = user.friends; // This should be an array of phone numbers of friends

    // Emit the 'user-connected' event to friends only (not to all users)
    if (friendsPhoneNumbers && friendsPhoneNumbers.length > 0) {
      for (const friendPhoneNumber of friendsPhoneNumbers) {
        const friend = await User.findOne({ phone_number: friendPhoneNumber }); // Find the friend user by phone number
        if (!friend) {
          console.log(`Friend with phone number ${friendPhoneNumber} not found`);
          continue;
        }

        // Check if the user is blocked by the friend or if the friend is blocked by the user
        const isBlockedByUser = user.blocked_users.some(blocked => blocked.user_id === friendPhoneNumber);
        const isBlockedByFriend = friend.blocked_users.some(blocked => blocked.user_id === userId);

        // If the user is not blocked by the friend and the friend is not blocked by the user, send the user-connected event
        if (!isBlockedByUser && !isBlockedByFriend) {
          const friendSocketId = await getUserSocketId(friendPhoneNumber);
          if (friendSocketId) {
            // Emit the 'user-connected' event to the friend's socket
            io.to(friendSocketId).emit("user-connected", { userId });
          }
        } else {
          console.log(`User ${userId} is blocked by or has blocked ${friendPhoneNumber}, not sending 'user-connected' event.`);
        }
      }
    }

    // Notify undelivered messages to the user if any
    const messageSenders = await notifyUndeliveredMessages(userId);
    if (messageSenders.length > 0) {
      for (const senderPhoneNumber of messageSenders) {
        const senderSocketId = await getUserSocketId(senderPhoneNumber);
        if (senderSocketId) {
          io.to(senderSocketId).emit("messageNotification", {
            senderPhoneNumber,
            receiverPhoneNumber: userId,
            status: "undelivered",
          });
        }
      }
    }

    // Optionally handle undelivered message status if required
    const undeliveredMessageStatus = await getUndeliveredMessageStatus(userId);
    if (undeliveredMessageStatus.length > 0) {
      // If you need to send undelivered message status, uncomment the next line
      // io.to(socket.id).emit("receiveMessage", undeliveredMessageStatus);
    }
  } catch (err) {
    console.error("Error in register event:", err);
  }
};
const handleRemoveFromBlockedCache = async(io,socket,msg)=>{

  const {userId, blockedUserId } = msg
  const cacheKey = `${userId}-${blockedUserId}`;
  
  if (blockedUserCache.has(cacheKey)) {
    blockedUserCache.delete(cacheKey); // Remove from the cache
    console.log(`Blocked user cache cleared for: ${userId} and ${blockedUserId}`);
  }
}
const handleAddToBlockedCache = async (io, socket, msg) => {
  const { userId, blockedUserId } = msg;

  const cacheKey = `${userId}-${blockedUserId}`;

  // Check if the cache already has this blocked user pair
  if (!blockedUserCache.has(cacheKey)) {
    // Add the blocked user pair to the cache
    blockedUserCache.set(cacheKey, { userId, blockedUserId });
    console.log(`Blocked user cache updated for: ${userId} and ${blockedUserId}`);
    
    // Optionally emit an event to notify other parts of the system if necessary
    io.emit('blockedUserCacheUpdated', { userId, blockedUserId });
  } else {
    console.log(`User ${userId} has already blocked ${blockedUserId}`);
  }
};





// const handleRegister = async (socket, io, { userId }) => {
//   try {
//     await setUserSocketId(userId, socket.id);
//     io.emit("user-connected", { userId });

//     const messageSenders = await notifyUndeliveredMessages(userId);
//     if (messageSenders.length > 0) {
//       for (const senderId of messageSenders) {
//         const senderSocketId = await getUserSocketId(senderId);
//         if (senderSocketId) {
//           io.to(senderSocketId).emit("messageNotification", {
//             senderId,
//             receiverId: userId,
//             status: "undelivered",
//           });
//         }
//       }
//     }

//     const undeliveredMessageStatus = await getUndeliveredMessageStatus(userId);
//     if (undeliveredMessageStatus.length > 0) {
//       // io.to(socket.id).emit("receiveMessage", undeliveredMessageStatus);
//       // await deleteUndeliveredMessageStatus(userId);
//     }
//   } catch (err) {
//     console.error("Error in register event:", err);
//   }
// };

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
  const { senderId, receiverId } = msg;

  try {
    // Find the sender and receiver by phone number
    const sender = await User.findOne({ phone_number: senderId });
    const receiver = await User.findOne({ phone_number: receiverId });

    // Ensure both users exist
    if (!sender) {
      console.log("Sender not found");
      return;
    }
    if (!receiver) {
      console.log("Receiver not found");
      return;
    }

    // Check if the sender has blocked the receiver
    const isSenderBlocked = sender.blocked_users.some(
      (blocked) => blocked.user_id === receiverId
    );

    // Check if the receiver has blocked the sender
    const isReceiverBlocked = receiver.blocked_users.some(
      (blocked) => blocked.user_id === senderId
    );

    // If either user has blocked the other, do not send the message
    if (isSenderBlocked || isReceiverBlocked) {
      console.log("Message not sent. One user has blocked the other.");
      return;
    }

    // Retrieve the device token of the receiver
    const deviceToken = receiver.device_token;
    console.log("Receiver's Device Token:", deviceToken);

    // Check if the receiver is online via socket connection
    const receiverSocketId = await getUserSocketId(receiverId);

    if (receiverSocketId) {
      // If the receiver is online, send the message via socket
      console.log("Message received and sent via socket.");
      io.to(receiverSocketId).emit("receiveMessage", msg);
    } else {
      // If the receiver is offline, save the message and send a push notification
      const newMessage = new Message(msg);
      await newMessage.save();
      
      // Send push notification
      const result = await sendNotification(deviceToken, senderId, msg.content, msg);
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



// const handleSendMessage = async (io, msg) => {
//   const { id, senderId, receiverId } = msg;

//   try {
//     const receiver = await User.findOne({ phone_number: receiverId });
//     // Retrieve device token from the receiver


//     const blockedUsers = receiver.blocked_users
    
//     const deviceToken = receiver.device_token;
//     console.log("Receiver's Device Token:", deviceToken);

//     const receiverSocketId = await getUserSocketId(receiverId);
//     if (receiverSocketId) {
//       console.log("message receievd");
//       io.to(receiverSocketId).emit("receiveMessage", msg);
//       console.log("message sent.....");
//       // const newMessage = new Message(msg);
//       // await newMessage.save();
//     } else {
//       const newMessage = new Message(msg);
//       await newMessage.save();
//       const result = await sendNotification(
//         deviceToken,
//         senderId,
//         msg.content,
//         msg
//       );
//       if (result) {
//         console.log("Notification sent successfully.");
//       } else {
//         console.log("Notification failed but continuing...");
//       }
//     }
//   } catch (err) {
//     console.error("Error in sendMessage event:", err);
//   }
// };

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

// const handleCheckUserStatus = async (socket, userId, chatId) => {
//   try {
//     console.log(userId, "as");

//     // const userSocketId = await getUserSocketId(userId);
//     const friendSocketId = await getUserSocketId(chatId);
//     const status = friendSocketId ? "online" : "offline";
//     socket.emit("checkUserStatus", { chatId, status });
//   } catch (err) {
//     console.error("Error in checkUserStatus event:", err);
//   }
// };

const handleCheckUserStatus = async (socket, userId, chatId) => {
  try {
    console.log(userId, "checking status for", chatId);

    // Get the user's details using userId (which is the phone number)
    const user = await User.findOne({ phone_number: userId });
    if (!user) {
      console.error('User not found');
      return;
    }

    // Get the friend's details using chatId (which is the phone number)
    const friend = await User.findOne({ phone_number: chatId });
    if (!friend) {
      console.error('Friend not found');
      return;
    }

    // Check if the user is blocked by the friend or if the friend is blocked by the user
    const isBlockedByUser = user.blocked_users.some(blocked => blocked.user_id === chatId);
    const isBlockedByFriend = friend.blocked_users.some(blocked => blocked.user_id === userId);

    if (isBlockedByUser || isBlockedByFriend) {
      console.log(`User ${userId} or Friend ${chatId} is blocked, not sending status`);
      socket.emit("checkUserStatus", { chatId, status: "blocked" });
      return;
    }

    // Otherwise, check if the friend is online or offline
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

// Optimized handleTypingStatus function
// const handleTypingStatus = async (io, socket, message) => {
//   const { chatId, userId, status } = message;

//   try {
//     // Check if the user is blocked
//     const blocked = await isBlocked(userId, chatId);

//     if (blocked) {
//       console.log(`User ${userId} or Friend ${chatId} is blocked, typing status not sent.`);
//       return;
//     }

//     // Implement debounce for typing events to avoid excessive calls
//     const debounceKey = `${userId}-${chatId}`;

//     // Clear debounce if the user stopped typing
//     if (status === 'stopped') {
//       if (typingStatusDebounceCache.has(debounceKey)) {
//         typingStatusDebounceCache.delete(debounceKey);
//         console.log("User stopped typing. Typing status cleared.");
        
//         // Emit "stop typing" event to receiver after debounce timeout
//         const receiverSocketId = await getUserSocketId(chatId);
//         if (receiverSocketId) {
//           io.to(receiverSocketId).emit("typingStatusRecieve", { userId, chatId, status: 'stopped' });
//           console.log("Stop typing message sent to receiver.");
//         }
//       }
//       return; // Early exit, as we're handling stop typing
//     }

//     // If typing event is debounced, ignore
//     if (typingStatusDebounceCache.has(debounceKey)) {
//       console.log("Typing status event is debounced.");
//       return; // Prevent further processing until debounce timeout is cleared
//     }

//     // Add to debounce cache to prevent rapid consecutive calls
//     typingStatusDebounceCache.set(debounceKey, true);

//     // Set timeout to remove debounce key after a certain period (e.g., 2 seconds)
//     setTimeout(() => {
//       typingStatusDebounceCache.delete(debounceKey);
//     }, 2000); // Adjust debounce time as needed (2 seconds in this example)

//     // Emit typing status to receiver
//     const receiverSocketId = await getUserSocketId(chatId);
//     if (receiverSocketId) {
//       io.to(receiverSocketId).emit("typingStatusRecieve", message);
//       console.log("Typing status message sent to receiver.");
//     } else {
//       console.log("Receiver not online, message not sent.");
//     }
//   } catch (err) {
//     console.error("Error in typingStatus event:", err);
//   }
// };

// Cache to store debounce states for typing events
// const typingStatusDebounceCache = new Map();

// Cache to store debounce states for typing events

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
  handleRemoveFromBlockedCache,
  handleAddToBlockedCache ,
};
