const mongoose = require('mongoose');

const accessTokenSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Profile',
        },

        accessToken: {
            type: String,
            required: true,
        },

        accessTokenExpiresAt: {
            type: Date,
            required: true,
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

mongoose.model('AccessToken', accessTokenSchema, 'accesstokens');
