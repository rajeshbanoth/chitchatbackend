const mongoose = require('mongoose');

const lastSeenSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    last_seen: {
        type: Date,
        default: Date.now,
    },
});

const LastSeen = mongoose.model('LastSeen', lastSeenSchema);

module.exports = LastSeen;
