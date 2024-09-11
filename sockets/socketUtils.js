const {
  getUserSocketId,
  setUserSocketId,
  setUndeliveredMessages,
  getUndeliveredMessages,
  deleteUndeliveredMessages,
} = require('../redis/redis');
const { v4: uuidv4 } = require('uuid');

module.exports = (io) => {
  io.use((socket, next) => {
    if (socket.handshake.query) {
      let callerId = socket.handshake.query.callerId;
      socket.user = callerId;
      next();
    }
  });

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.join(socket.user);

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
        socket.emit('sendMessage', { ...forwardedMessage, receiver_id: receiverId });
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
    
    socket.on('join', (roomId) => {
      socket.join(roomId);
      socket.to(roomId).emit('user-connected', socket.id);
    });
  
    // Handle offer event
    socket.on('offer', (offer, roomId) => {
      socket.to(roomId).emit('offer', offer, socket.id);
    });
  
    // Handle answer event
    socket.on('answer', (answer, roomId) => {
      socket.to(roomId).emit('answer', answer, socket.id);
    });
  
    // Handle ICE candidate event
    socket.on('ice-candidate', (candidate, roomId) => {
      socket.to(roomId).emit('ice-candidate', candidate, socket.id);
    });



    socket.on('disconnect', () => {
      console.log('A user disconnected:', socket.id);
      socket.broadcast.emit('user-disconnected', socket.id);
    });
  });
};
