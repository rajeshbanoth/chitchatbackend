const mongoose = require('mongoose');

const attachmentSchema = new mongoose.Schema({
    type: {
        type: String, // 'image', 'video', 'document', 'audio', etc.
        required: true,
    },
    url: {
        type: String,
        required: true,
    },
    size: {
        type: Number, // Size of the attachment in bytes
        required: true,
    },
    name: {
        type: String, // Name of the attachment file
        required: true,
    },
});

const temporaryAttachmentSchema = new mongoose.Schema({
    type: {
        type: String, // 'image', 'video', 'document', 'audio', etc.
        required: true,
    },
    url: {
        type: String,
        required: true,
    },
    size: {
        type: Number, // Size of the attachment in bytes
        required: true,
    },
    name: {
        type: String, // Name of the attachment file
        required: true,
    },
});

const messageSchema = new mongoose.Schema({
    id: {
        type: String,
        required: true,
        unique: true,
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
    content: {
        type: String,
        default: '',
    },
    attachments: {
        type: String,
        default: null,
    },
    thumbnail: {
        type: String,
        default: null,
    },
    timestamp: {
        type: Number, // Storing as an integer timestamp
        required: true,
    },
    status: {
        type: String, // 'sent', 'delivered', 'read'
        default: 'sent',
    },
    isEncrypted: {
        type: Boolean,
        default: true,
    },
    forwardedCount: {
        type: Number,
        default: 0,
    },
    originalSenderId: {
        type: String,
        default: null,
    },
    replyTo: {
        type: String,
        default: null,
    },
    replies: {
        type: [String],
        default: [],
    },
    replyContent: {
        type: String,
        default: null,
    },
    reaction: {
        type: String,
        default: null,
    },
    messageType: {
        type: String, // e.g., 'text', 'image', 'video', etc.
        required: true,
    },

    contentUri: {
        type: String,
        default: null,
    },
    contactName: {
        type: String,
        default: null,
    },
    contactPhoneNumber: {
        type: String,
        default: null,
    },
    latitude: {
        type: Number,
        default: null,
    },
    longitude: {
        type: Number,
        default: null,
    },
    isThumbnailDownloaded: {
        type: Boolean,
        default: false, // false means not downloaded, true means downloaded
    },
    isOriginalAttachmentDownloaded: {
        type: Boolean,
        default: false, // false means not downloaded, true means downloaded
    },
    
});

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;
