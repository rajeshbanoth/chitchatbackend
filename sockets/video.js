const {
  getUserSocketId,
  setUserSocketId,
  setUndeliveredMessages,
  getUndeliveredMessages,
  deleteUndeliveredMessages,
} = require('../redis/redis');
const { v4: uuidv4 } = require('uuid');
const userSocketMap = new Map();

module.exports = (io) => {

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('register', async ({ mobileNumber }) => {
      console.log(mobileNumber, socket.id, "user register");
      userSocketMap.set(mobileNumber, socket.id);
    });

    socket.on('sendMessage', async (msg) => {
      const { id, senderId, receiverId, content, attachments, timeStamp } = msg;

      try {
        const receiverSocketId = await getUserSocketId(receiverId);

        if (receiverSocketId) {
          io.to(receiverSocketId).emit('receiveMessage', msg);
        } else {
          let undeliveredMessages = await getUndeliveredMessages(receiverId);
          undeliveredMessages.push(msg);
          await setUndeliveredMessages(receiverId, undeliveredMessages);
        }
      } catch (err) {
        console.error('Error handling message:', err);
      }
    });

    socket.on('forwardMessage', async ({ originalMessageId, receiverId }) => {
      const originalMessage = await getUndeliveredMessages(originalMessageId);
      if (originalMessage) {
        const forwardedMessage = { ...originalMessage, forwarded: true };
        socket.emit('sendMessage', { ...forwardedMessage, receiverId });
      }
    });

    socket.on('reactToMessage', ({ messageId, reaction }) => {
      io.emit('messageReacted', { messageId, reaction });
    });

    socket.on('deleteMessage', ({ messageId, userId }) => {
      io.emit('messageDeleted', { messageId, userId });
    });

    socket.on('editMessage', ({ messageId, newContent }) => {
      io.emit('messageEdited', { messageId, newContent });
    });

    socket.on('uploadMedia', async ({ sender_id, receiver_id, media }) => {
      const message = { sender_id, receiver_id, attachments: [media] };
      socket.emit('sendMessage', message);
    });

    socket.on('setTimer', ({ messageId, duration }) => {
      setTimeout(() => {
        io.emit('deleteMessage', { messageId });
      }, duration);
    });

    socket.on('initiate-call', ({ from, to }) => {
      const receiverSocketId = userSocketMap.get(to);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('incoming-call', { caller: from, callId: socket.id });
      }
    });

    socket.on('accept-call', ({ from, callId }) => {
      const callerSocketId = userSocketMap.get(from);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-accepted', { callId: socket.id });
        io.to(socket.id).emit('call-accepted', { callId: callerSocketId });
      }
    });

    socket.on('reject-call', ({ from }) => {
      const callerSocketId = userSocketMap.get(from);
      if (callerSocketId) {
        io.to(callerSocketId).emit('call-rejected');
      }
    });

    socket.on('end-call', () => {
      io.emit('call-ended');
    });

    socket.on('ice-candidate', (candidate, callId) => {
      io.to(callId).emit('ice-candidate', candidate);
    });

    socket.on('offer', (offer, callId) => {
      io.to(callId).emit('offer', offer);
    });

    socket.on('answer', (answer, callId) => {
      io.to(callId).emit('answer', answer);
    });

    socket.on('disconnect', () => {
      console.log('A user disconnected:', socket.id);
      userSocketMap.forEach((socketId, mobileNumber) => {
        if (socketId === socket.id) {
          userSocketMap.delete(mobileNumber);
        }
      });
    });

  });
};
