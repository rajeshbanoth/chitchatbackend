const mongoose = require('mongoose');

const authSessionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    device_type: {
        type: String, // 'iOS', 'Android', 'Web', etc.
        required: true,
    },
    device_info: {
        type: String, // Additional info about the device (e.g., OS version)
        default: '',
    },
    ip_address: {
        type: String, // IP address from which the user logged in
        default: '',
        
        // required: true,
    },
    session_token: {
        type: String,
        required: true,
        unique: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
    },
    last_active: {
        type: Date, // Timestamp of last activity
        default: Date.now,
    },
    is_active: {
        type: Boolean,
        default: true, // Active by default when created
    },
    updated_at: {
        type: Date,
        default: Date.now,
    },
});

authSessionSchema.pre('save', function(next) {
    this.updated_at = Date.now();
    next();
});

const AuthSession = mongoose.model('AuthSession', authSessionSchema);

module.exports = AuthSession;
