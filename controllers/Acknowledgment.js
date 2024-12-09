const MessageAcknowledgement = require("../models/MessageAcknowledgement"); // Adjust path as needed

/**
 * Creates a new message acknowledgment record.
 *
 * @param {String} message_id - The ID of the message being acknowledged.
 * @param {String} acknowledgeTo - The recipient of the acknowledgment.
 * @param {String} acknowledgeFrom - The sender of the acknowledgment.
 * @param {String} status - The status of the acknowledgment.
 * @returns {Object} The saved message acknowledgment object.
 * @throws Will throw an error if the database operation fails.
 */
const createMessageAcknowledgement = async (message_id, acknowledgeTo, acknowledgeFrom, status) => {
  try {
    // Create a new message acknowledgment instance
    const messageAcknowledgement = new MessageAcknowledgement({
      message_id,
      acknowledgeTo,
      acknowledgeFrom,
      status,
    });

    // Save to the database
    const savedAcknowledgement = await messageAcknowledgement.save();

    return savedAcknowledgement; // Return the saved acknowledgment
  } catch (error) {
    console.error("Error creating message acknowledgment:", error);
    throw new Error("Failed to create message acknowledgment");
  }
};

module.exports = createMessageAcknowledgement;
