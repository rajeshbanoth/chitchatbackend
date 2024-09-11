const reactionSchema = new mongoose.Schema({
    message_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        required: true,
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    reaction_type: {
        type: String, // e.g., 'like', 'love', 'laugh'
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
});
