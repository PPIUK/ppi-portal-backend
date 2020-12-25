const mongoose = require('mongoose');

const mvpAwardsFormSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Profile',
        },
        nominatedUser: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            ref: 'Profile',
        },
        submitterType: {
            type: String,
            enum: ['Nominee', 'Nominator'],
        },
        awardTypes: {
            type: [String],
            validator: (field) => {
                for (let award in field)
                    if (
                        ![
                            'Academic Excellence',
                            'Best Academic Contribution',
                            'Most Dedicated for Tackling Real World Problems',
                        ].includes(award)
                    )
                        return false;
                return true;
            },
        },
        awardIndicators: [
            {
                awardType: [
                    {
                        indicator: { type: String },
                        subindicators: [
                            {
                                name: { type: String },
                                elaboration: { type: String },
                            },
                        ],
                    },
                ],
            },
        ],
        submitted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

mongoose.model('MvpAwardsForm', mvpAwardsFormSchema, 'mvpawardsforms');
