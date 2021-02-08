const mongoose = require('mongoose');

const authorizationCodeSchema = new mongoose.Schema(
    {
        user: {
            // FIXME: THIS IS THE ERROR FOR SAVING
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Profile',
        },

        authorizationCode: {
            type: String,
            required: true,
        },

        expiresAt: {
            type: Date,
            required: true,
        },

        redirectUri: {
            type: String,
            required: true,
        },

        scope: {
            type: String,
        },

        client: {
            type: String,
        },

        createdAt: {
            type: Date,
            required: true,
            default: Date.now,
            expires: 43200, //12 hrs
        },
    },
    { timestamps: true }
);

mongoose.model('AuthorizationCode', authorizationCodeSchema, 'authorizationcodes');
