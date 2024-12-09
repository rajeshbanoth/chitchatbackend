const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  phone_number: {
    type: String,
    required: true,
    unique: true, // Ensures phone number is unique
  },
  name: {
    type: String,
    default: null, // User's display name
  },
  profile_picture: {
    type: String,
    default: null, // Path or URL to the user's profile picture
  },
  profile_thumbnail: {
    type: String,
    default: null, // Path or URL to the thumbnail of the profile picture
  },
  bio: {
    type: String,
    default: null, // User's bio
  },
  status: {
    type: String,
    default: "", // User's current status (e.g., "Available")
  },
  created_at: {
    type: Date,
    default: Date.now, // Timestamp when the account was created
  },
  updated_at: {
    type: Date,
    default: Date.now, // Timestamp for the last update
  },
  last_seen: {
    type: Date,
    default: null, // Timestamp for the user's last seen status
  },
  is_online: {
    type: Boolean,
    default: false, // Indicates if the user is currently online
  },
  is_verified: {
    type: Boolean,
    default: false, // Indicates if the user's account is verified
  },
  device_token: {
    type: String,
    required: true, // The current device token for push notifications
  },
  device_token_last_updated: {
    type: Date,
    default: null, // Timestamp when the device token was last updated
  },
  device_token_history: {
    type: [
      {
        token: String,
        updated_at: Date,
      },
    ],
    default: [], // Keeps track of all previous device tokens and update times
  },
  publicKey: {
    type: String,
    required: true, // User's public key for encryption/authentication
  },
  public_key_last_updated: {
    type: Date,
    default: null, // Timestamp when the public key was last updated
  },
  public_key_history: {
    type: [
      {
        key: String,
        updated_at: Date,
      },
    ],
    default: [], // Keeps track of all previous public keys and update times
  },
  language: {
    type: String,
    default: "en", // User's preferred language
  },
  timezone: {
    type: String,
    default: "UTC", // User's timezone
  },
  email: {
    type: String,
    default: null, // Optional email address for the user
  },
  friends: {
    type: [String],
    default: [], // List of phone numbers or user IDs for friends/contacts
  },
  notifications_enabled: {
    type: Boolean,
    default: true, // Whether notifications are enabled for the user
  },
  theme: {
    type: String,
    default: "light", // User's theme preference (light or dark)
  },
  two_factor_enabled: {
    type: Boolean,
    default: false, // Indicates if two-factor authentication is enabled
  },
  blocked_users: {
    type: [String],
    default: [], // List of user IDs or phone numbers of blocked users
  },
  last_bio_updated: {
    type: Date,
    default: null, // Timestamp when the bio was last updated
  },
  last_public_key_updated: {
    type: Date,
    default: null, // Timestamp when the public key was last updated
  },
  last_profile_picture_updated: {
    type: Date,
    default: null, // Timestamp when the profile picture was last updated
  },
});

// Middleware to update the `updated_at` field automatically on save
userSchema.pre("save", function (next) {
  this.updated_at = Date.now();
  next();
});

// Middleware to track and save changes to `bio`, `profile_picture`, `publicKey`, and `device_token`
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
