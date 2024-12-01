const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const messageAcknowledgmentSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true, // Ensures the id is unique
    required: true,
    default: uuidv4, // Auto-generate a unique ID if not provided
  },
  senderId: {
    type: String,
    required: true,
  },
  receiverId: {
    type: String,
    required: true,
  },
  messageId: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    required: true,
    enum: ["received", "seen"], // Only "received" or "seen" are valid statuses
  },
  receivedAt: {
    type: Date,
    required: function () {
      return this.status === "received";
    },
  },
  seenAt: {
    type: Date,
    required: function () {
      return this.status === "seen";
    },
  },
});

const MessageAcknowledgment = mongoose.model(
  "MessageAcknowledgment",
  messageAcknowledgmentSchema
);

module.exports = MessageAcknowledgment;
