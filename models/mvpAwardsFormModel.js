const mongoose = require('mongoose');

const mvpAwardsFormSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Profile',
        },
        formField: {
            type: String,
            required: true,
        },
        submitted: {
            type: Boolean,
            default: false,
            required: true,
        }
    },
    { timestamps: true }
);

mongoose.model('MvpAwardsForm', mvpAwardsFormSchema, 'mvpawardsforms');
