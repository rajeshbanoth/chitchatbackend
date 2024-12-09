const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const messageAcknowledgementSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true, // Ensures the id is unique
    required: true,
    default: uuidv4, // Automatically generates a UUID
  },
  message_id: {
    type: String,
    required: true,
  },
  acknowledgeTo: {
    type: String,
    required: true,
  },
  acknowledgeFrom: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "recieved", "sent","seen"], // Example statuses
    required: true,
  },
});

const MessageAcknowledgement = mongoose.model(
  "MessageAcknowledgement",
  messageAcknowledgementSchema
);

module.exports = MessageAcknowledgement;
