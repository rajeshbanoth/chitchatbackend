const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const deletedMessageSchema = new mongoose.Schema({
  id: {
    type: String,
    unique: true, // Ensures the id is unique
    required: true,
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
});

const DeletedMessage = mongoose.model("DeletedMessage", deletedMessageSchema);

module.exports = DeletedMessage;
