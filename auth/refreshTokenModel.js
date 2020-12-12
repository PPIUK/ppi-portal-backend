const mongoose = require('mongoose');

const refreshTokenSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'profile'
    },

    refreshToken: {
        type: String,
        required: true
    },

    refreshTokenExpiresAt: {
        type: Date,
        required: true
    },

    client: {
        type: String
    },

    createdAt: {
        type: Date,
        required: true,
        default: Date.now,
        expires: 86400 //1 day
    }

}, {timestamps: true});

module.exports = mongoose.model('RefreshTokens', refreshTokenSchema);