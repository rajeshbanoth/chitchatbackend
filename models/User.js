const mongoose = require('mongoose');
const { parsePhoneNumberFromString } = require('libphonenumber-js');

const userSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: [true, 'User ID is required'],
    unique: true,
    validate: {
      validator: function(v) {
        return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(v);
      },
      message: props => `${props.value} is not a valid user ID!`
    }
  },
  mobile_number: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
  },
  otp: {
    type: String,
    default: null,
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  profile_photo: {
    type: String,
    default: null,
  },
  bio: {
    type: String,
    default: null,
  },
  last_online: {
    type: Date,
    default: null,
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  publicKey:{
    type: String,
    required: true,
  }
});

userSchema.pre('save', function(next) {
  if (this.isModified('mobile_number') || this.isNew) {
    const phoneNumber = parsePhoneNumberFromString(this.mobile_number);
    if (phoneNumber) {
      this.mobile_number = phoneNumber.number; // Normalizes to E.164 format
    } else {
      next(new Error('Invalid mobile number'));
    }
  }
  next();
});
const User = mongoose.model('User', userSchema);
module.exports = User;
