const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    phone_number: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true,
    },
    created_at: {
        type: Date,
        default: Date.now,
        expires: '10m', // OTP will automatically be removed after 10 minutes
    },
});

const OTP = mongoose.model('OTP', otpSchema);

module.exports = OTP;
