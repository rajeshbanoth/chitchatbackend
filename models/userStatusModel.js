const mongoose = require('mongoose');

const userStatusSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true,
    },
    status_message: {
        type: String,
        default: '',
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
});

const UserStatus = mongoose.model('UserStatus', userStatusSchema);

module.exports = UserStatus;
