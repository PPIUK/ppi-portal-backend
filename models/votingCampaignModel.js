const mongoose = require('mongoose');

const candidateStatementSchema = new mongoose.Schema({
    missionStatement: {
        type: String,
        required: true,
    },
    visionStatement: {
        type: String,
        required: true,
    },
});

const votingCandidateSchema = new mongoose.Schema({
    candidateID: {
        type: mongoose.Schema.ObjectId,
        required: true,
    },
    statement: {
        type: candidateStatementSchema,
        required: true,
    },
    votes: {
        type: Number,
        required: true,
        default: 0,
    },
});

const votingCampaignSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        required: true,
    },
    banner: {
        type: mongoose.Schema.ObjectId,
        required: false,
    },
    activeOverride: {
        type: Boolean,
        required: true,
        default: false,
    },
    nominateStart: {
        type: Date,
        required: true,
    },
    nominateEnd: {
        type: Date,
        required: true,
    },
    voteStart: {
        type: Date,
        required: true,
    },
    voteEnd: {
        type: Date,
        required: true,
    },
    candidates: {
        type: [votingCandidateSchema],
        default: [],
    },
    voted: {
        type: [mongoose.Schema.ObjectId],
        default: [],
    },
    public: {
        type: Boolean,
        required: true,
    },
});

votingCampaignSchema.pre('validate', function (next) {
    if (this.nominateStart >= this.nominateEnd) {
        this.invalidate(
            'nominateEnd',
            'nominateEnd must be after nominateStart'
        );
    }

    let gracePeriod = new Date(this.voteStart);
    gracePeriod.setHours(gracePeriod.getHours() - 1);
    if (this.nominateEnd >= gracePeriod) {
        this.invalidate(
            'voteStart',
            'voteStart should be more than 1 hour after nominateEnd'
        );
    }

    if (this.voteStart >= this.voteEnd) {
        this.invalidate('voteEnd', 'voteEnd must be after voteStart');
    }
    next();
});

mongoose.model('VotingCampaign', votingCampaignSchema, 'votingcampaigns');
