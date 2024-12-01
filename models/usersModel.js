const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phone_number: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    default: null,
    // required: true,
  },
  profile_picture: {
    type: String,
    default: null,
  },
  profile_thumbnail: {
    type: String,
    default: null,
  },
  bio: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    default: "",
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
  updated_at: {
    type: Date,
    default: Date.now,
  },
  last_seen: {
    type: Date,
    default: null,
  },
  is_online: {
    type: Boolean,
    default: false,
  },
  is_verified: {
    type: Boolean,
    default: false,
  },
  device_token: {
    type: String,
    default: null,
  },
  language: {
    type: String,
    default: "en",
  },
  timezone: {
    type: String,
    default: "UTC",
  },
  publicKey: {
    type: String,
    required: true,
  },
  deviceToken: {
    type: String,
    required: true,
  },
});

// Middleware to update the `updated_at` field on save
userSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
