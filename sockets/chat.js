// const {
//   getUserSocketId,
//   setUserSocketId,
//   setUndeliveredMessages,
//   getUndeliveredMessages,
//   deleteUndeliveredMessages,
//   deleteUserSocketId,
//   notifyUndeliveredMessages,
//   redisClient,
//   getUserIdfomSocketId,
//   addSenderToList,
//   removeSenderFromList,
//   getUndeliveredMessageStatus,
//   setUndeliveredMessageStatus,
//   deleteUndeliveredMessageStatus,
// } = require("../redis/redis");

// module.exports = (io) => {
//   io.use((socket, next) => {
//     if (socket.handshake.query) {
//       let callerId = socket.handshake.query.callerId;
//       socket.user = callerId;
//       next();
//     } else {
//       next(new Error("Authentication error"));
//     }
//   });

//   io.on("connection", (socket) => {
//     console.log("A user connected:", socket.id);

//     socket.join(socket.user);

//     socket.on("register", async ({ userId }) => {
//       try {
//         await setUserSocketId(userId, socket.id);
//         io.emit("user-connected", { userId: userId });

//         // Notify about undelivered messages
//         const messageSenders = await notifyUndeliveredMessages(userId);
//         if (messageSenders.length > 0) {
//           for (const senderId of messageSenders) {
//             const senderSocketId = await getUserSocketId(senderId);
//             console.log(senderSocketId, "sender");
//             if (senderSocketId) {
//               io.to(senderSocketId).emit("messageNotification", {
//                 senderId,
//                 receiverId: userId,
//                 status: "undelivered",
//               });
//             }
//           }
//         }

//         // Send undelivered messages Status to the newly connected user
//         const undeliveredMessageStatus = await getUndeliveredMessageStatus(
//           userId
//         );
//         if (undeliveredMessageStatus.length > 0) {
//           io.to(socket.id).emit("receiveMessage", undeliveredMessageStatus);
//           await deleteUndeliveredMessageStatus(userId); // Clear the undelivered messages once sent
//         }
//       } catch (err) {
//         console.error("Error in register event:", err);
//       }
//     });

//     socket.on("batchMessageStatusUpdate", async (statusUpdates) => {
//       try {
//         const userUpdatesMap = {};

//         // Organize updates by user
//         for (const update of statusUpdates) {
//           const { acknowledgeTo } = update;
//           if (!userUpdatesMap[acknowledgeTo]) {
//             userUpdatesMap[acknowledgeTo] = [];
//           }
//           userUpdatesMap[acknowledgeTo].push(update);
//         }

//         // Process each user's updates
//         for (const [userId, updates] of Object.entries(userUpdatesMap)) {
//           const receiverSocketId = await getUserSocketId(userId);

//           if (receiverSocketId) {
//             console.log(updates, "updates");
//             io.to(receiverSocketId).emit("receiveBatchMessageStatus", updates);
//           } else {
//             // Save undelivered message statuses
//             const undeliveredMessageStatus = await getUndeliveredMessageStatus(
//               userId
//             );
//             undeliveredMessageStatus.push(...updates);
//             await setUndeliveredMessageStatus(userId, undeliveredMessageStatus);
//             console.log(`Saved undelivered message status for user ${userId}`);
//           }
//         }
//       } catch (err) {
//         console.error("Error handling batch message status update:", err);
//       }
//     });

//     socket.on("sendMessage", async (msg) => {
//       const { id, senderId, receiverId } = msg;
//       console.log(id, senderId, receiverId, "a");
//       try {
//         const receiverSocketId = await getUserSocketId(receiverId);
//         console.log(receiverSocketId, "receive");
//         if (receiverSocketId) {
//           io.to(receiverSocketId).emit("receiveMessage", msg);
//         } else {
//           console.log("Receiver is offline, adding sender to the list");
//           await addSenderToList(receiverId, senderId);
//         }
//       } catch (err) {
//         console.error("Error in sendMessage event:", err);
//       }
//     });

//     socket.on("resendMessage", async (msg) => {
//       const { senderId, receiverId } = msg;
//       console.log("resending message", msg);
//       try {
//         await removeSenderFromList(receiverId, senderId);
//         const receiverSocketId = await getUserSocketId(receiverId);
//         if (receiverSocketId) {
//           io.to(receiverSocketId).emit("receiveMessage", msg);
//         }
//       } catch (err) {
//         console.error("Error in resendMessage event:", err);
//       }
//     });

//     socket.on("messageAcknowledge", async (msg) => {
//       console.log(msg, "newsss");
//       const receiverSocketId = await getUserSocketId(msg.acknowledgeTo);
//       io.to(receiverSocketId).emit("messageAcknowledgementStatus", msg);
//     });

//     socket.on("sendFileChunk", async (msg) => {
//       const receiverSocketId = await getUserSocketId(msg.receiverId);
//       console.log("sending");
//       io.to(receiverSocketId).emit("receiveFileChunk", msg);
//     });

//     socket.on("fileTransferComplete", async (msg) => {
//       const receiverSocketId = await getUserSocketId(msg.receiverId);
//       io.to(receiverSocketId).emit("fileTransferComplete", msg);
//     });

//     socket.on("forwardMessage", async ({ originalMessageId, receiverId }) => {
//       try {
//         const originalMessage = await getUndeliveredMessages(originalMessageId);
//         if (originalMessage) {
//           const forwardedMessage = { ...originalMessage, forwarded: true };
//           socket.emit("sendMessage", { ...forwardedMessage, receiverId });
//         }
//       } catch (err) {
//         console.error("Error in forwardMessage event:", err);
//       }
//     });

//     socket.on("reactToMessage", ({ messageId, reaction }) => {
//       io.emit("messageReacted", { messageId, reaction });
//     });

//     socket.on("deleteMessage", ({ messageId, userId }) => {
//       io.emit("messageDeleted", { messageId, userId });
//     });

//     socket.on("editMessage", ({ messageId, newContent }) => {
//       io.emit("messageEdited", { messageId, newContent });
//     });

//     socket.on("uploadMedia", async ({ senderId, receiverId, media }) => {
//       try {
//         const message = { senderId, receiverId, attachments: [media] };
//         socket.emit("sendMessage", message);
//       } catch (err) {
//         console.error("Error in uploadMedia event:", err);
//       }
//     });

//     socket.on("setTimer", ({ messageId, duration }) => {
//       setTimeout(() => {
//         io.emit("deleteMessage", { messageId });
//       }, duration);
//     });

//     socket.on("join", (roomId) => {
//       socket.join(roomId);
//       socket.to(roomId).emit("user-connected", socket.id);
//     });

//     socket.on("checkUserStatus", async ({ userId, chatId }) => {
//       try {
//         console.log(userId, chatId);
//         const userSocketId = await getUserSocketId(userId);
//         const friendSocketId = await getUserSocketId(chatId);
//         const status = friendSocketId ? "online" : "offline";
//         socket.emit("checkUserStatus", { chatId, status });
//       } catch (err) {
//         console.error("Error in checkUserStatus event:", err);
//       }
//     });

//     socket.on("call-initiation", async ({ callerId, receiverId }) => {
//       try {
//         const receiverSocketId = await getUserSocketId(receiverId);
//         if (receiverSocketId) {
//           io.to(receiverSocketId).emit("call-invitation", { callerId });
//         }
//       } catch (err) {
//         console.error("Error in call-initiation event:", err);
//       }
//     });

//     socket.on("call-accepted", async ({ chatId }) => {
//       console.log("call accepted");
//       try {
//         const receiverSocketId = await getUserSocketId(chatId);
//         io.to(receiverSocketId).emit("user-connected_to_call");
//       } catch (err) {
//         console.error("Error in call-accepted event:", err);
//       }
//     });

//     socket.on("offer", async (offer, chatId) => {
//       try {
//         const receiverSocketId = await getUserSocketId(chatId);
//         if (receiverSocketId) {
//           socket.to(receiverSocketId).emit("offer", offer, socket.id);
//         }
//       } catch (err) {
//         console.error("Error in offer event:", err);
//       }
//     });

//     socket.on("answer", async (answer, chatId) => {
//       try {
//         const receiverSocketId = await getUserSocketId(chatId);
//         if (receiverSocketId) {
//           socket.to(receiverSocketId).emit("answer", answer, socket.id);
//         }
//       } catch (err) {
//         console.error("Error in answer event:", err);
//       }
//     });

//     socket.on("ice-candidate", async (candidate, chatId) => {
//       try {
//         const receiverSocketId = await getUserSocketId(chatId);
//         if (receiverSocketId) {
//           socket
//             .to(receiverSocketId)
//             .emit("ice-candidate", candidate, socket.id);
//         }
//       } catch (err) {
//         console.error("Error in ice-candidate event:", err);
//       }
//     });

//     socket.on("end-call", async (chatId) => {
//       try {
//         const receiverSocketId = await getUserSocketId(chatId);
//         if (receiverSocketId) {
//           socket.to(receiverSocketId).emit("end-call");
//         }
//       } catch (err) {
//         console.error("Error in end-call event:", err);
//       }
//     });

//     socket.on("disconnect", async () => {
//       try {
//         console.log("A user disconnected:", socket.id, socket.user);
//         const user = await getUserIdfomSocketId(socket.id);
//         await deleteUserSocketId(user);
//         io.emit("user-disconnected", { userId: user });
//       } catch (err) {
//         console.error("Error in disconnect event:", err);
//       }
//     });
//   });
// };



const {
  getUserSocketId,
  setUserSocketId,
  setUndeliveredMessages,
  getUndeliveredMessages,
  deleteUndeliveredMessages,
  deleteUserSocketId,
  notifyUndeliveredMessages,
  getUserIdfomSocketId,
  addSenderToList,
  removeSenderFromList,
  getUndeliveredMessageStatus,
  setUndeliveredMessageStatus,
  deleteUndeliveredMessageStatus,
} = require("../redis/redis");

const {
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
  handleReceiveThumbnail,
  handleThumbnail,
  handleDeleteMessageonBothSides,
  handleTypingStatus
} = require("../socketEvents/SocketEvents");

module.exports = (io) => {
  io.use((socket, next) => {
    if (socket.handshake.query) {
      let callerId = socket.handshake.query.callerId;
      socket.user = callerId;
      next();
    } else {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("A user connected:", socket.id);

    socket.join(socket.user);

    socket.on("register", (data) => handleRegister(socket, io, data));
    socket.on("batchMessageStatusUpdate", (statusUpdates) =>
      handleBatchMessageStatusUpdate(io, statusUpdates)
    );
    socket.on("sendMessage", (msg) => handleSendMessage(io, msg));
    socket.on("typingStatus", (msg) => handleTypingStatus(io,socket, msg));
    socket.on("resendMessage", (msg) => handleResendMessage(io, msg));
    socket.on("messageAcknowledge", (msg) =>
      handleMessageAcknowledge(io, msg)
    );
    socket.on("sendFileChunk", (msg) => handleReceiveFileChunk(io, socket, msg));

    socket.on("DeleteMessageOnBothSides",(msg=>{
      handleDeleteMessageonBothSides(io,socket,msg)
    }))
     
    socket.on("sendThumbnail", (msg) => handleThumbnail(io, socket, msg));
    socket.on("sendFileThumbnail",(msg)=>handleReceiveThumbnail(io,msg))
    socket.on("fileTransferComplete", (msg) =>
      handleFileTransferComplete(io, msg)
    );
    socket.on("forwardMessage", (data) => handleForwardMessage(socket, data));
    socket.on("reactToMessage", (data) => handleReactToMessage(io, data));
    socket.on("deleteMessage", (data) => handleDeleteMessage(io, data));
    socket.on("editMessage", (data) => handleEditMessage(io, data));
    socket.on("uploadMedia", (data) => handleUploadMedia(socket, data));
    socket.on("setTimer", (data) => handleSetTimer(io, data));
    socket.on("join", (roomId) => handleJoinRoom(socket, roomId));
    socket.on("checkUserStatus", ({userId, chatId}) => handleCheckUserStatus(socket, userId, chatId));
    socket.on("call-initiation", (data) => handleCallInitiation(io, data));
    socket.on("call-accepted", (data) => handleCallAccepted(io, data));
    socket.on("offer", (offer, chatId) => handleOffer(socket, offer, chatId));
    socket.on("answer", (answer, chatId) => handleAnswer(socket, answer, chatId));
    socket.on("ice-candidate", (candidate, chatId) => handleIceCandidate(socket, candidate, chatId));
    socket.on("end-call", (chatId) => handleEndCall(socket, chatId));
    socket.on("disconnect", () => handleDisconnect(io, socket));
  });
};

