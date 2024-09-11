const { Server } = require("socket.io");
const { getUserSocketId, setUserSocketId, setUndeliveredMessages, getUndeliveredMessages, deleteUndeliveredMessages } = require('../redis/redis');
const { v4: uuidv4 } = require('uuid');

let IO;

module.exports.initIO = (httpServer) => {
  IO = new Server(httpServer);

  IO.use((socket, next) => {
    if (socket.handshake.query) {
      let callerId = socket.handshake.query.callerId;
      socket.user = callerId;
      next();
    }
  });

  IO.on("connection", (socket) => {
    console.log('a user connected:', socket.user);
    socket.join(socket.user);

    // Handle user registration and undelivered messages
    socket.on('register', async ({ userId }) => {
      await setUserSocketId(userId, socket.id);
      const undeliveredMessages = await getUndeliveredMessages(userId);
      if (undeliveredMessages.length > 0) {
        undeliveredMessages.forEach((msg) => {
          socket.emit('receiveMessage', msg);
        });
        await deleteUndeliveredMessages(userId);
      }
    });

    // Handle sending messages
    socket.on('sendMessage', async (msg) => {
      const { id, senderId, receiverId, content, attachments, timeStamp } = msg;
      try {
        const receiverSocketId = await getUserSocketId(receiverId);
        if (receiverSocketId) {
          IO.to(receiverSocketId).emit('receiveMessage', msg);
        } else {
          let undeliveredMessages = await getUndeliveredMessages(receiverId);
          undeliveredMessages.push(msg);
          await setUndeliveredMessages(receiverId, undeliveredMessages);
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    // Handle message forwarding
    socket.on('forwardMessage', async ({ originalMessageId, receiverId }) => {
      const originalMessage = await getUndeliveredMessages(originalMessageId);
      if (originalMessage) {
        const forwardedMessage = { ...originalMessage, forwarded: true };
        socket.emit('sendMessage', { ...forwardedMessage, receiver_id: receiverId });
      }
    });

    // Handle message reactions
    socket.on('reactToMessage', ({ messageId, reaction }) => {
      IO.emit('messageReacted', { messageId, reaction });
    });

    // Handle message deletion
    socket.on('deleteMessage', ({ messageId, userId }) => {
      IO.emit('messageDeleted', { messageId, userId });
    });

    // Handle message editing
    socket.on('editMessage', ({ messageId, newContent }) => {
      IO.emit('messageEdited', { messageId, newContent });
    });

    // Handle media upload
    socket.on('uploadMedia', async ({ sender_id, receiver_id, media }) => {
      const message = { sender_id, receiver_id, attachments: [media] };
      socket.emit('sendMessage', message);
    });

    // Handle WebRTC signaling
    socket.on("call", (data) => {
      let calleeId = data.calleeId;
      let rtcMessage = data.rtcMessage;
      socket.to(calleeId).emit("newCall", {
        callerId: socket.user,
        rtcMessage: rtcMessage,
      });
    });

    socket.on("answerCall", (data) => {
      let callerId = data.callerId;
      let rtcMessage = data.rtcMessage;
      socket.to(callerId).emit("callAnswered", {
        callee: socket.user,
        rtcMessage: rtcMessage,
      });
    });

    socket.on("ICEcandidate", (data) => {
      let calleeId = data.calleeId;
      let rtcMessage = data.rtcMessage;
      socket.to(calleeId).emit("ICEcandidate", {
        sender: socket.user,
        rtcMessage: rtcMessage,
      });
    });

    // Handle timed messages/view once
    socket.on('setTimer', ({ messageId, duration }) => {
      setTimeout(() => {
        IO.emit('deleteMessage', { messageId });
      }, duration);
    });

    socket.on('disconnect', async () => {
      console.log('user disconnected:', socket.user);
    });
  });
};

module.exports.getIO = () => {
  if (!IO) {
    throw Error("IO not initialized.");
  } else {
    return IO;
  }
};
