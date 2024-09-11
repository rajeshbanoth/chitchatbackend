const mongoose = require('mongoose');

const blockedUserSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    blocked_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    blocked_at: {
        type: Date,
        default: Date.now,
    },
});

const BlockedUser = mongoose.model('BlockedUser', blockedUserSchema);

module.exports = BlockedUser;
