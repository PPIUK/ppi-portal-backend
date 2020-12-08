const mongoose = require('mongoose');

//Schema for the verification email token
const tokenSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        ref: 'Profile'
    },

    token: {
        type: String,
        required: true
    },

    createdAt: {
        type: Date,
        required: true,
        default: Date.now,
        expires: 43200 //12 hrs
    }

}, {timestamps: true});

module.exports = mongoose.model('VerificationTokens', tokenSchema);