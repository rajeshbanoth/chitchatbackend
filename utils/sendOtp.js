require('dotenv').config();
const twilio = require('twilio');

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;
const isTesting = process.env.NODE_ENV === 'development';
const fixedOtp = process.env.FIXED_OTP;

const client = twilio(accountSid, authToken);

const sendOtpToPhone = async (phone_number, otp) => {
    if (isTesting) {
        console.log(`OTP ${fixedOtp} (fixed for testing) sent to phone number ${phone_number}`);
        return;
    }

    try {
        await client.messages.create({
            body: `Your OTP code is ${otp}`,
            from: twilioPhoneNumber,
            to: phone_number,
        });
        console.log(`OTP ${otp} sent to phone number ${phone_number}`);
    } catch (error) {
        console.error(`Failed to send OTP to ${phone_number}:`, error);
        throw new Error('Failed to send OTP');
    }
};

module.exports = { sendOtpToPhone };
