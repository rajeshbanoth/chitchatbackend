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
    required: true,
  },
  device_token_last_updated: {
    type: Date,
    default: null,
  },
  device_token_history: {
    type: [
      {
        token: String,
        updated_at: Date,
      },
    ],
    default: [],
  },
  publicKey: {
    type: String,
    required: true,
  },
  public_key_last_updated: {
    type: Date,
    default: null,
  },
  public_key_history: {
    type: [
      {
        key: String,
        updated_at: Date,
      },
    ],
    default: [],
  },
  language: {
    type: String,
    default: "en",
  },
  timezone: {
    type: String,
    default: "UTC",
  },
  email: {
    type: String,
    default: null,
  },
  friends: {
    type: [String],
    default: [],
  },
  notifications_enabled: {
    type: Boolean,
    default: true,
  },
  theme: {
    type: String,
    default: "light",
  },
  two_factor_enabled: {
    type: Boolean,
    default: false,
  },
  blocked_users: {
    type: [
      {
        user_id: String, // ID or phone number of the blocked user
        blocked_at: {
          type: Date,
          default: Date.now, // Timestamp when the user was blocked
        },
      },
    ],
    default: [],
  },
  last_bio_updated: {
    type: Date,
    default: null,
  },
  last_public_key_updated: {
    type: Date,
    default: null,
  },
  last_profile_picture_updated: {
    type: Date,
    default: null,
  },
});

// Middleware to update the `updated_at` field automatically on save
userSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

// Middleware to track and save changes to specific fields
userSchema.pre("save", function (next) {
  if (this.isModified("bio")) {
    this.last_bio_updated = new Date();
  }
  if (this.isModified("publicKey")) {
    this.last_public_key_updated = new Date();
    this.public_key_history.push({
      key: this.publicKey,
      updated_at: this.last_public_key_updated,
    });
  }
  if (this.isModified("device_token")) {
    this.device_token_last_updated = new Date();
    this.device_token_history.push({
      token: this.device_token,
      updated_at: this.device_token_last_updated,
    });
  }
  next();
});

const User = mongoose.model("User", userSchema);

module.exports = User;
