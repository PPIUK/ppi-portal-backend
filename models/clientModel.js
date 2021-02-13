const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema(
    {
        clientId: {
            type: String,
            required: true
        },

        clientSecret: {
            type: String,
            required: true
        },

        redirectUris: {
            type: [String],
            required: true,
        },

        grants: {
            type: [String],
            required: true,
        },
    },
    { timestamps: true }
);

mongoose.model('Client', clientSchema, 'clients');
