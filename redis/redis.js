// const { set } = require('mongoose');
// const redis = require('redis');

// // Create a Redis client
// const redisClient = redis.createClient();

// redisClient.on('error', (err) => {
//   console.error('Redis error:', err);
// });

// redisClient.on('connect', () => {
//   console.log('Connected to Redis');
// });

// const connectRedis = async () => {
//   try {
//     await redisClient.connect();
//     console.log('Redis client connected');
//   } catch (err) {
//     console.error('Error connecting to Redis:', err);
//   }
// };

// const disconnectRedis = async () => {
//   try {
//     await redisClient.quit();
//     console.log('Redis client disconnected');
//   } catch (err) {
//     console.error('Error disconnecting Redis client:', err);
//   }
// };

// // User-related functions
// const setUserSocketId = async (userId, socketId) => {
//   try {
//     await redisClient.hSet('onlineUsers', userId, socketId);
//     await redisClient.hSet('socketIdToUserId', socketId, userId);

//     console.log(`Set user ${userId} with socket ID ${socketId}`);
//   } catch (err) {
//     console.error('Error setting user socket ID:', err);
//   }
// };

// const getUserSocketId = async (userId) => {
//   try {
//     const user = await redisClient.hGet('onlineUsers', userId);
//     console.log(user, "user");
//     return user;
//   } catch (err) {
//     console.error('Error getting user socket ID:', err);
//     return null;
//   }
// };
// const getUserIdfomSocketId = async (socketId) => {
//   try {
//     const user = await redisClient.hGet('socketIdToUserId', socketId);
  
//     return user;
//   } catch (err) {
//     console.error('Error getting user socket ID:', err);
//     return null;
//   }
// };

// const deleteUserSocketId = async (userId) => {
//   console.log(userId);
//   try {
//     await redisClient.hDel('onlineUsers', userId);
//     console.log(`Deleted user ${userId}`);
//   } catch (err) {
//     console.error('Error deleting user socket ID:', err);
//   }
// };

// // Undelivered messages functions
// const getUndeliveredMessages = async (userId) => {
//   try {
//     const messages = await redisClient.hGet('undeliveredMessages', userId);
//     return messages ? JSON.parse(messages) : [];
//   } catch (err) {
//     console.error('Error retrieving undelivered messages:', err);
//     return [];
//   }
// };

// const setUndeliveredMessages = async (userId, messages) => {
//   try {
//     await redisClient.hSet('undeliveredMessages', userId, JSON.stringify(messages));
//   } catch (err) {
//     console.error('Error setting undelivered messages:', err);
//   }
// };

// const deleteUndeliveredMessages = async (userId) => {
//   try {
//     await redisClient.hDel('undeliveredMessages', userId);
//   } catch (err) {
//     console.error('Error deleting undelivered messages:', err);
//   }
// };


// // message status update fynction
// // Undelivered messages functions
// const getUndeliveredMessageStatus = async (userId) => {
//   try {
//     const messages = await redisClient.hGet('undeliveredMessageStatus', userId);
//     return messages ? JSON.parse(messages) : [];
//   } catch (err) {
//     console.error('Error retrieving undelivered messages:', err);
//     return [];
//   }
// };

// const setUndeliveredMessageStatus= async (userId, messages) => {
//   try {
//     await redisClient.hSet('undeliveredMessageStatus', userId, JSON.stringify(messages));
//   } catch (err) {
//     console.error('Error setting undelivered messages:', err);
//   }
// };

// const deleteUndeliveredMessageStatus = async (userId) => {
//   try {
//     await redisClient.hDel('undeliveredMessageStatus', userId);
//   } catch (err) {
//     console.error('Error deleting undelivered messages:', err);
//   }
// };



// // Notify users about undelivered messages
// const notifyUndeliveredMessages = async (userId) => {
//   try {
//     // Get list of users who attempted to send messages to this user
//     const messageSenders = await redisClient.sMembers(`messageSenders:${userId}`);
//     console.log(messageSenders,"sender")
//  return messageSenders
//   } catch (err) {
//     return []
//     console.error('Error notifying undelivered messages:', err);
//   }
// };

// // Add sender to messageSenders list
// const addSenderToList = async (userId, senderId) => {
//   try {
//     const alreadyExists = await redisClient.sIsMember(`messageSenders:${userId}`, senderId);
//     if (!alreadyExists) {
//       await redisClient.sAdd(`messageSenders:${userId}`, senderId);
//       console.log(`Sender ${senderId} added to list for user ${userId}`);
//     } else {
//       console.log(`Sender ${senderId} already exists in the list for user ${userId}`);
//     }
//   } catch (err) {
//     console.error('Error adding sender to list:', err);
//   }
// };


// // Remove sender from messageSenders list
// const removeSenderFromList = async (userId, senderId) => {
//   try {
//     await redisClient.sRem(`messageSenders:${userId}`, senderId);
//   } catch (err) {
//     console.error('Error removing sender from list:', err);
//   }
// };

// module.exports = {
//   redisClient,
//   connectRedis,
//   disconnectRedis,
//   setUserSocketId,
//   getUserSocketId,
//   deleteUserSocketId,
//   getUndeliveredMessages,
//   setUndeliveredMessages,
//   deleteUndeliveredMessages,
//   notifyUndeliveredMessages,
//   addSenderToList,
//   removeSenderFromList,
//   getUserIdfomSocketId,
//   getUndeliveredMessageStatus,
//   setUndeliveredMessageStatus,
//   deleteUndeliveredMessageStatus
  
// };









const { set } = require('mongoose');
const redis = require('redis');

// Create a Redis client
const redisClient = redis.createClient();
let isRedisAvailable = true; // Track Redis availability

// In-memory fallback object
const inMemoryStore = {
  onlineUsers: {},
  socketIdToUserId: {},
  undeliveredMessages: {},
  undeliveredMessageStatus: {},
  messageSenders: {},
};

redisClient.on('error', (err) => {
  // console.error('Redis error:', err);
  isRedisAvailable = false; // Redis is unavailable
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
  isRedisAvailable = true; // Redis is available
});

// Helper functions to manage in-memory storage for sets
const addToSet = (store, key, value) => {
  if (!store[key]) {
    store[key] = new Set();
  }
  store[key].add(value);
};

const removeFromSet = (store, key, value) => {
  if (store[key]) {
    store[key].delete(value);
  }
};

const getSetMembers = (store, key) => {
  return store[key] ? Array.from(store[key]) : [];
};
const connectRedis = async () => {
  try {
    await redisClient.connect();
    console.log('Redis client connected');
  } catch (err) {
    console.error('Error connecting to Redis:', err);
  }
};

const disconnectRedis = async () => {
  try {
    await redisClient.quit();
    console.log('Redis client disconnected');
  } catch (err) {
    console.error('Error disconnecting Redis client:', err);
  }
};

// Redis operations with fallback to in-memory store
const setUserSocketId = async (userId, socketId) => {
  if (isRedisAvailable) {
    try {
      await redisClient.hSet('onlineUsers', userId, socketId);
      await redisClient.hSet('socketIdToUserId', socketId, userId);
      console.log(`Set user ${userId} with socket ID ${socketId}`);
    } catch (err) {
      console.error('Error setting user socket ID in Redis:', err);
    }
  } else {
    inMemoryStore.onlineUsers[userId] = socketId;
    inMemoryStore.socketIdToUserId[socketId] = userId;
    console.log(`Set user ${userId} with socket ID ${socketId} in memory`);
  }
};

const getUserSocketId = async (userId) => {
  if (isRedisAvailable) {
    try {
      return await redisClient.hGet('onlineUsers', userId);
    } catch (err) {
      console.error('Error getting user socket ID from Redis:', err);
      return null;
    }
  } else {
    return inMemoryStore.onlineUsers[userId] || null;
  }
};

const getUserIdFromSocketId = async (socketId) => {
  if (isRedisAvailable) {
    try {
      return await redisClient.hGet('socketIdToUserId', socketId);
    } catch (err) {
      console.error('Error getting user ID from socket ID in Redis:', err);
      return null;
    }
  } else {
    return inMemoryStore.socketIdToUserId[socketId] || null;
  }
};

const deleteUserSocketId = async (userId) => {
  if (isRedisAvailable) {
    try {
      await redisClient.hDel('onlineUsers', userId);
      console.log(`Deleted user ${userId} from Redis`);
    } catch (err) {
      console.error('Error deleting user socket ID from Redis:', err);
    }
  } else {
    delete inMemoryStore.onlineUsers[userId];
    console.log(`Deleted user ${userId} from memory`);
  }
};

// Undelivered messages
const getUndeliveredMessages = async (userId) => {
  if (isRedisAvailable) {
    try {
      const messages = await redisClient.hGet('undeliveredMessages', userId);
      return messages ? JSON.parse(messages) : [];
    } catch (err) {
      console.error('Error retrieving undelivered messages from Redis:', err);
      return [];
    }
  } else {
    return inMemoryStore.undeliveredMessages[userId] || [];
  }
};

const setUndeliveredMessages = async (userId, messages) => {
  if (isRedisAvailable) {
    try {
      await redisClient.hSet('undeliveredMessages', userId, JSON.stringify(messages));
    } catch (err) {
      console.error('Error setting undelivered messages in Redis:', err);
    }
  } else {
    inMemoryStore.undeliveredMessages[userId] = messages;
  }
};

const deleteUndeliveredMessages = async (userId) => {
  if (isRedisAvailable) {
    try {
      await redisClient.hDel('undeliveredMessages', userId);
    } catch (err) {
      console.error('Error deleting undelivered messages from Redis:', err);
    }
  } else {
    delete inMemoryStore.undeliveredMessages[userId];
  }
};

// Message status updates
const getUndeliveredMessageStatus = async (userId) => {
  if (isRedisAvailable) {
    try {
      const messages = await redisClient.hGet('undeliveredMessageStatus', userId);
      return messages ? JSON.parse(messages) : [];
    } catch (err) {
      console.error('Error retrieving undelivered message statuses from Redis:', err);
      return [];
    }
  } else {
    return inMemoryStore.undeliveredMessageStatus[userId] || [];
  }
};

const setUndeliveredMessageStatus = async (userId, messages) => {
  if (isRedisAvailable) {
    try {
      await redisClient.hSet('undeliveredMessageStatus', userId, JSON.stringify(messages));
    } catch (err) {
      console.error('Error setting undelivered message statuses in Redis:', err);
    }
  } else {
    inMemoryStore.undeliveredMessageStatus[userId] = messages;
  }
};

// Notification for undelivered messages
const notifyUndeliveredMessages = async (userId) => {
  if (isRedisAvailable) {
    try {
      const messageSenders = await redisClient.sMembers(`messageSenders:${userId}`);
      return messageSenders;
    } catch (err) {
      console.error('Error notifying undelivered messages from Redis:', err);
      return [];
    }
  } else {
    return getSetMembers(inMemoryStore.messageSenders, userId);
  }
};

const addSenderToList = async (userId, senderId) => {
  if (isRedisAvailable) {
    try {
      await redisClient.sAdd(`messageSenders:${userId}`, senderId);
    } catch (err) {
      console.error('Error adding sender to list in Redis:', err);
    }
  } else {
    addToSet(inMemoryStore.messageSenders, userId, senderId);
  }
};

const removeSenderFromList = async (userId, senderId) => {
  if (isRedisAvailable) {
    try {
      await redisClient.sRem(`messageSenders:${userId}`, senderId);
    } catch (err) {
      console.error('Error removing sender from list in Redis:', err);
    }
  } else {
    removeFromSet(inMemoryStore.messageSenders, userId, senderId);
  }
};

module.exports = {
  redisClient,
  connectRedis,
  disconnectRedis,
  setUserSocketId,
  getUserSocketId,
  deleteUserSocketId,
  getUndeliveredMessages,
  setUndeliveredMessages,
  deleteUndeliveredMessages,
  notifyUndeliveredMessages,
  addSenderToList,
  removeSenderFromList,
  getUserIdFromSocketId,
  getUndeliveredMessageStatus,
  setUndeliveredMessageStatus,
 
};
