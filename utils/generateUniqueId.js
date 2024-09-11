const crypto = require('crypto');

function generateUniqueId() {
  // Create a unique ID based on current timestamp and a random string
  const timestamp = Date.now().toString(36); // Convert timestamp to base36
  const randomString = crypto.randomBytes(6).toString('hex'); // Generate a random 6-byte hex string
  return `${timestamp}-${randomString}`;
}

module.exports = generateUniqueId;
