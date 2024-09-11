const mongoose = require("mongoose");

// Define the schema for file metadata
const fileMetadataSchema = new mongoose.Schema({
  msg_id: {
    type: String,
    required: true,
  },
  chatId: {
    type: String,
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
  fileName: {
    type: String,
    required: true,
  },
  fileType: {
    type: String, // e.g., 'image', 'video', 'document','thumbnail
    required: true,
  },

  downloadStatus: {
    type: Boolean,
    default: false, // false means not downloaded, true means downloaded
  },
  expirationDate: {
    type: Date,
    required: true,
  },
});

// Create the model from the schema
const FileMetadata = mongoose.model("FileMetadata", fileMetadataSchema);

module.exports = FileMetadata;
