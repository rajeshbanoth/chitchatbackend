const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    device_token: {
        type: String,
        required: true,
    },
    device_type: {
        type: String, // 'iOS', 'Android', etc.
        required: true,
    },
    last_used: {
        type: Date,
        default: Date.now,
    },
    is_active: {
        type: Boolean,
        default: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
});

deviceTokenSchema.pre('save', function(next) {
    this.updated_at = Date.now();
    next();
});

const DeviceToken = mongoose.model('DeviceToken', deviceTokenSchema);

module.exports = DeviceToken;
