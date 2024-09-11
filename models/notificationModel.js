const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    type: {
        type: String, // 'message', 'friend_request', 'system', etc.
        required: true,
    },
    content: {
        type: String,
        required: true,
    },
    is_read: {
        type: Boolean,
        default: false,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
    metadata: {
        sender_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null,
        },
        chat_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Chat',
            default: null,
        },
        attachment_url: {
            type: String,
            default: null,
        },
        additional_info: {
            type: String,
            default: '',
        },
    },
});

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
