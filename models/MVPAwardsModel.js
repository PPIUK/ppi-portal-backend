const mongoose = require('mongoose');

const MVPAwardsSchema = mongoose.Schema({
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
});

mongoose.model('MVPAwards', MVPAwardsSchema, 'mvpawards');
